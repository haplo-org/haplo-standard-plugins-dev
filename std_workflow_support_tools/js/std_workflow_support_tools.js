
// To prevent this support tool from being used in states where it would
// do unhelpful things, set the __preventSupportMoveBack__ flag.

// --------------------------------------------------------------------------

var CanUseSupportToolsForAllWorkflows = O.action("std:workflow:support-tools:allow-for-all-workflows").
    title("Workflow: Use support tools for all workflows").
    allow("group", Group.Administrators).
    allow("group", Group.WorkflowOverride);

var canUse = function(user) {
    // TODO: Per label allow move backwards
    return user.allowed(CanUseSupportToolsForAllWorkflows);
};

// --------------------------------------------------------------------------

// Use private service to extend all workflow UI
P.implementService("__std:workflow:add-support-actions-to-panel__", function(M, builder) {
    if(canUse(O.currentUser)) {
        let i = P.locale().text("template");
        builder.panel(8888887).
            spaceAbove().
            element(0, {title:i["Support tools"]}).
            link(1, "/do/workflow-support-tools/move-back/"+M.workUnit.id, i["Move back..."]);
    }
});

// --------------------------------------------------------------------------

const MOVE_BACK_ACTION = "SUPPORT-MOVE-BACK";

var MoveBack = P.form("move-back", "form/move-back.json");

P.respond("GET,POST", "/do/workflow-support-tools/move-back", [
    {pathElement:0, as:"workUnit", allUsers:true}
], function(E, workUnit) {
    if(!canUse(O.currentUser)) { O.stop("Not permitted"); }
    let workflow = O.service("std:workflow:definition_for_name", workUnit.workType);
    let M = workflow.instance(workUnit);

    let entries = M.timelineSelect().or((sq) => {
            sq.where("previousState", "!=", null).
               where("action", "=", MOVE_BACK_ACTION);
        }).order("datetime","DESC").limit(2);

    // Check that moving back is allowed
    let notPossible = (why) => E.render({M:M,why:why}, "move-back-not-possible");
    if(entries.length < 2) {
        return notPossible("no-previous");
    }
    if(_.find(entries, (e) => e.action === MOVE_BACK_ACTION)) {
        return notPossible("already");
    }
    if(M.flags.__preventSupportMoveBack__) {
        return notPossible("prevented");
    }
    // TODO: Check M.flags.preventSupportMoveBack or something

    let previousEntry = entries[1],
        actionableUserBeforeMove = workUnit.actionableBy;

    let document = {};
    let form = MoveBack.handle(document, E.request);
    if(form.complete) {
        M.addTimelineEntry(MOVE_BACK_ACTION, {reason:document.reason});
        // Target for state is saved into the next entry
        M._forceMoveToStateFromTimelineEntry(previousEntry, entries[0].target);

        // Email affected users
        M.sendEmail({
            template: P.template("email/move-back-notification"),
            to: [
                actionableUserBeforeMove,
                M.workUnit.actionableBy // will be de-duplicated
            ],
            view: {
                fullUrl: O.application.url + M.url,
                reason: document.reason,
                movedBy: O.currentUser
            }
        });

        return E.response.redirect(M.url);
    }
    E.render({
        M: M,
        form: form,
        currentStateText: M._getText(['status'], [M.state]),
        previousStateText: M._getText(['status'], [previousEntry.state]),
        previousUser: previousEntry.user,
        isError: E.request.method === "POST"
    });
});

P.implementService("__std:workflow:fallback-timeline-entry-deferrred__", function(M, entry) {
    if(entry.action === MOVE_BACK_ACTION) {
        return P.template("timeline/support-move-back").deferredRender({entry:entry});
    }
});

// When this is installed, override the admin tools to use this
P.implementService("__std:workflow:alternative-move-state-interface__", function(M) {
    return "/do/workflow-support-tools/move-back/"+M.workUnit.id;
});
