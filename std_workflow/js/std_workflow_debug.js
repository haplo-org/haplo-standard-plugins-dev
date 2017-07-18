/* Haplo Platform                                     http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var showDebugTools = function() {
    return (O.PLUGIN_DEBUGGING_ENABLED &&
        O.currentAuthenticatedUser &&
        O.currentAuthenticatedUser.isSuperUser &&
        O.currentAuthenticatedUser.data["std_workflow:enable_debugging"]);
};

var getCheckedInstanceForDebugging = function(workUnit) {
    if(!showDebugTools()) { return; }
    var workflow = P.allWorkflows[workUnit.workType];
    if(!workflow) { O.stop("Workflow not implemented"); }
    return workflow.instance(workUnit);
};

// --------------------------------------------------------------------------

P.WorkflowInstanceBase.prototype._addDebugActionPanelElements = function(builder) {
    var adminPanel = builder.panel(8888888);
    if(!showDebugTools()) {
        if(O.currentUser.isSuperUser) {
            adminPanel.link(99, "/do/workflow/debug/debug-mode/enable/"+this.workUnit.id, "Enable debug mode");
        }
        return;
    }
    var uid, currentlyWith = this.workUnit.actionableBy;
    // if actionable user is a group, get the first member of that group's user id
    if(currentlyWith.isGroup) { 
        var members = currentlyWith.loadAllMembers();
        if(members.length) { uid = members[0].id; }
    } else { uid = currentlyWith.id; }

    builder.panel(1).style("special").element(1, {
        deferred: P.template("debug/quick-actions").deferredRender({
            M: this,
            uid: (uid !== O.currentUser.id ? uid : undefined),
            debugEntities: debugEntities
        })
    });

    var debugEntities;
    var entities = this.entities;
    if(entities) { 
        debugEntities = [];
        var usedAsActionableBy = {};
        _.each(this.$states, function(defn,name) {
            if(defn.actionableBy) {
                usedAsActionableBy[defn.actionableBy] = true;
            }
        });
        _.each(entities.$entityDefinitions, function(v,name) {
            var first = entities[name+'_refMaybe'];
            var user = first ? O.user(first) : undefined;
            var i = {
                name: name,
                uid: user ? user.id : undefined,
                usedAsActionableBy: usedAsActionableBy[name]
            };
            if(user) { debugEntities.unshift(i); } else { debugEntities.push(i); }
        });

        builder.panel(1).style("special").element(1, {
            deferred: P.template("debug/sidebar").deferredRender({
                M: this,
                debugEntities: debugEntities
            })
        });
    }

    adminPanel.link(99, "/do/workflow/debug/debug-mode/disable/"+this.workUnit.id, "DISABLE DEBUG MODE", "terminal");
};

// --------------------------------------------------------------------------

if(O.PLUGIN_DEBUGGING_ENABLED) {

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

    // --------------------------------------------------------------------------

    P.respond("GET,POST", "/do/workflow/debug/debug-mode", [
        {pathElement:0, as:"string"},
        {pathElement:1, as:"workUnit", optional: true, allUsers:true} // used for redirect
    ], function(E, option, workUnit) {
        // superusers only
        if(!O.currentAuthenticatedUser.isSuperUser) { return; }
        var M, workflow = workUnit ? P.allWorkflows[workUnit.workType] : undefined;
        if(workflow) { M = workflow.instance(workUnit); }
        // enable/disable debug mode on a per-user basis
        O.currentAuthenticatedUser.data["std_workflow:enable_debugging"] = (option === "enable");
        return M ? E.response.redirect(M.url) : E.response.redirect(O.application.url);
    });

}
