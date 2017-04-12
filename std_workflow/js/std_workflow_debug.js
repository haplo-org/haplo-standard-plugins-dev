/* Haplo Platform                                     http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var allowDebugging = function() {
    return (O.PLUGIN_DEBUGGING_ENABLED && O.currentAuthenticatedUser && O.currentAuthenticatedUser.isSuperUser);
};

var getCheckedInstanceForDebugging = function(workUnit) {
    if(!allowDebugging()) { return; }
    var workflow = P.allWorkflows[workUnit.workType];
    if(!workflow) { O.stop("Workflow not implemented"); }
    return workflow.instance(workUnit);
};

// --------------------------------------------------------------------------

P.WorkflowInstanceBase.prototype._addDebugActionPanelElements = function(builder) {
    if(!allowDebugging()) { return; }
    var uid, currentlyWith = this.workUnit.actionableBy;
    // if actionable user is a group, get the first member of that group's user id
    if(currentlyWith.isGroup) { 
        var members = currentlyWith.loadAllMembers();
        if(members.length) { uid = members[0].id; }
    } else { uid = currentlyWith.id; }

    builder.panel(1).style("special").element(1, {
        deferred: P.template("debug/quick-actions").deferredRender({
            M: this,
            uid: (uid !== O.currentUser.id ? uid : undefined)
        })
    });
};

// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/workflow/debug/transition-to-previous-state", [
    {pathElement:0, as:"workUnit", allUsers:true} // Security check below
], function(E, workUnit) {
    var M = getCheckedInstanceForDebugging(workUnit);
    var select = M.$timeline.select().where("workUnitId","=",M.workUnit.id).order("id",true).limit(2);
    var row = select.length > 1 ? select[1] : undefined;
    if(!row) { O.stop(); }
    M._forceMoveToStateFromTimelineEntry(row, null);
    return E.response.redirect(M.url);
});
