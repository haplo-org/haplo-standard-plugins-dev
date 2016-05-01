/* Haplo Platform                                     http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

/* Workflow permission rules look like:

   workflow type, entity name -> permissions for that entity

   workflow type, state -> permissions for actionableBy person in that state

   workflowPermissionsRules is a mapping from workflow names
   (workflow.fullName or workUnit.workType) to objects:

      entityPermissions[entity name] -> permissions string
      stateActionPermissions[state name] -> permissions string
*/

var workflowPermissionRules = {};

// spec is a list of rules
// Rules are either:
// { entity: NAME, hasPermission: PERM }
// { inState: NAME, actionableByHasPermission: PERM }

P.registerWorkflowFeature("std:permissions", function(workflow, spec) {
    var eps = {};
    var saps = {};
    _.each(spec, function(rule) {
        if ("entity" in rule &&
            "hasPermission" in rule) {
            eps[rule.entity] = rule.hasPermission;
        } else if ("inState" in rule &&
            "actionableByHasPermission" in rule) {
            saps[rule.inState] = rule.actionableByHasPermission;
        } else {
            throw "Invalid workflow permissions rule " + JSON.stringify(rule);
        }
    });
    workflowPermissionRules[workflow.fullName] = {
        entityPermissions: eps,
        stateActionPermissions: saps
    };
});

// As actionableBy might be a group, what we return is a list
// of user objects AND groups. Don't assume it's just users.
var checkPermissionsForObject = function(object, checkFunction) {
    var results = [];
    var objectRef = object.ref;
    _.each(workflowPermissionRules, function(rules, workUnitType) {
        console.log("objectRef=", objectRef);
        var units = O.work.query(workUnitType).ref(objectRef);

        _.each(units, function(unit) {
            console.log("unit:", unit, unit.workType);
//            console.log("workflow type:", P.allWorkflows[unit.workType]);
            if(P.allWorkflows[unit.workType]) {
                var M = P.allWorkflows[unit.workType].instance(unit);
                console.log("M:", M);
                console.log("rules:",rules);
                // Entity permissions
                for(var entityName in rules.entityPermissions) {
                    console.log("Entity name:", entityName, rules.entityPermissions[entityName]);
                    if(checkFunction(rules.entityPermissions[entityName])) {
                        var entities = M.entities[entityName + "_list"];
                        console.log("entities:", entities);
                        if(entities) {
                            results = results.concat(entities);
                        }
                    }
                }

                // actionableBy permissions
                if(rules.stateActionPermissions[M.state]) {
                    if(checkFunction(rules.stateActionPermissions[M.state])) {
                        results.push(unit.actionableBy);
                    }
                }
            }
        });
    });
    return results;
};

// API to permissions system

P.implementService("std:workflow:get_additional_readers_for_object", function(objectRef) {
    return checkPermissionsForObject(objectRef, function(perm) {
        console.log("perm(read|read-edit)", perm);
        return perm==="read" || perm==="read-edit";
    });
});

P.implementService("std:workflow:get_additional_writers_for_object", function(objectRef) {
    return checkPermissionsForObject(objectRef, function(perm) {
        console.log("perm(read-edit)", perm);
        return perm==="read-edit";
    });
});

// Change notification handlers

P.implementService("std:workflow:entities:replacement_changed", function(workUnit, workflow, entityName) {
    // FIXME: Be fussier. This only affects read permissions in practice, as
    // write perms are not cached. See about computing before/after read perms for
    // the object and see if they are actually changed, and do nothing
    // otherwise.
    if(O.serviceImplemented("std:workflow:permissions:permissions_changed_for_object")) {
        if(workflowPermissionRules[workUnit.workType]) {
            if(workUnit.ref) {
                O.service("std:workflow:permissions:permissions_changed_for_object",
                          workUnit.ref);
            }
        }
    }
});

// FIXME: Workflow state change handler, in case user has an actionableBy read permissions rule?
