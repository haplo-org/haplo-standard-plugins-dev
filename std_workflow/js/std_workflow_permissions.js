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
        if (rule.hasOwnProperty("entity") &&
            rule.hasOwnProperty("hasPermission")) {
            eps[rule.entity] = rule.hasPermission;
        }
    });
    _.each(spec, function(rule) {
        if (rule.hasOwnProperty("inState") &&
            rule.hasOwnProperty("actionableByHasPermission")) {
            saps[rule.inState] = rule.actionableByHasPermission;
        }
    });
    workflowPermissionRules[workflow.fullName] = {
        entityPermissions: eps,
        stateActionPermissions: saps
    };
});

// As actionableBy might be a group, what we return is a list
// of user objects AND groups. Don't assume it's just users.
var checkPermissionsForObject = function(objectRef, checkFunction) {
    var results = [];
    _.each(workflowPermissionRules, function(rules, workUnitType) {
        var units = O.work.query(workUnitType).ref(objectRef);

        _.each(units, function(unit) {
            if(P.allWorkflows[unit.workType]) {
                var M = P.allWorkflows[unit.workType].instance(unit);

                // Entity permissions
                for(var entityName in rules.entityPermissions) {
                    if(checkFunction(rules.entityPermissions[entityName])) {
                        var entities = M.entities[entityName + "_list"];
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
        return perm==="read" || perm==="read-write";
    });
});

P.implementService("std:workflow:get_additional_writers_for_object", function(objectRef) {
    return checkPermissionsForObject(objectRef, function(perm) {
        return perm==="read-write";
    });
});

// Change notification handlers

P.implementService("std:workflow:entities:replacement_changed", function(workUnit, workflow, entityName) {
    if(workflowPermissionRules[workUnit.workType]) {
        if(workUnit.ref) {
            O.service("std:workflow:permissions:permissions_changed_for_object",
                      workUnit.ref);
        }
    }
});
