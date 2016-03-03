/* Haplo Platform                                     http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// sepecification has properties:
//  replacements: a map of new entity name to object with properties:
//      entity: underlying entity name
//      assignableWhen: selector when the actionable user can edit the replacement
//      replacementTypes: Array of Refs of types of object which can be used to replace this entity
//      selectableWhen: (optional) selector determining when the user can select the entity for the workflow
//      listAll: (optional) Boolean for whether to display full entity_list to replace
//  onFinishPage: (optional) function returning url of page to transition to when replacements have been chosen

var chooseReplacementForms = {};

P.registerWorkflowFeature("std:entities:entity_replacement", function(workflow, specification) {
    if(!("constructEntitiesObject" in workflow)) {
        throw new Error('You must use("entities", {...}) before using the std:entities:entity_replacement workflow feature');
    }

    // This feature is implemented by adding in additional entity definitions into the existing entities.
    // A database stores a map of ref -> ref by workflow and entity name.
    // The timeline stores who did what replacements, and is rendered to show the history.

    workflow.$entityReplacementSpecification = specification;   // for use in the UI

    var entityDefinitions = workflow.$entitiesBase.$entityDefinitions;

    var plugin = workflow.plugin;

    var dbName = 'stdworkflowEr'+P.workflowNameToDatabaseTableFragment(workflow.name);
    plugin.db.table(dbName, {
        workUnitId:     { type:"int", indexed:true },   // which work unit (= instance of workflow)
        name:           { type:"text" },                // name of underlying entity
        entity:         { type:"ref" },                 // ref of entity which is being replaced
        replacement:    { type:"ref", nullable:true},   // ref of entity which should be used instead
        selected:       { type:"boolean"}               // boolean for if this entity is selected for this workflow
    });

    _.each(specification.replacements, function(info, name) {
        var unreplacedName = info.entity;

        entityDefinitions[name] = function(context) {
            // Build replacements map
            var replacements = O.refdict();
            var M = this.M; // may be undefined if there isn't a workflow instance yet
            if(M) {
                var query = plugin.db[dbName].select().
                    where("workUnitId", "=", M.workUnit.id).
                    where("name", "=", unreplacedName).
                    stableOrder();
                _.each(query, function(row) {
                    replacements.set(row.entity, row.replacement);
                });
            }
            // Return mapped entities
            if(context === "first") {
                var e = this[unreplacedName+"_refMaybe"];
                return e ? (replacements.get(e) || e) : undefined;
            } else {
                return _.map(this[unreplacedName+"_refList"], function(e) {
                    return replacements.get(e) || e;
                });
            }
        };

        // Ensure a form is defined for the relevant replacementTypes for this replacement.  Uses refs of each of 
        // the replacementTypes in the key so each dataSource/form pair is only defined once
        var names = makeNamesForTypes(info.replacementTypes);
        if(!chooseReplacementForms[names.form]) {
            P.dataSource(names.lookup, "object-lookup", info.replacementTypes);
            chooseReplacementForms[names.form] = makeEntityReplacementForm(names.form, names.lookup);
        }
    });

    // Use workflow functions to set up action panel links,
    //   * only displaying if there is at least one selected replacement
    //   * get link label from text system
    workflow.actionPanel({}, function(M, builder) {
        // TODO: replace with a selector calculated from the list of non-duplicated assignableWhen selectors
        if(M.workUnit.isActionableBy(O.currentUser) &&
                ((!_.isEmpty(findCurrentlyReplaceable(workflow, M, specification))) ||
                (!_.isEmpty(findCurrentlySelectable(M, specification))))) {
            var label = M._getTextMaybe(['entity-replacement:ui:action-panel-label'], [M.state]) || "Choose replacements";
            builder.link("default", "/do/workflow/entity-replacement/"+M.workUnit.id, label);
        }
    });

    // Timeline rendering for replacement events: workflow.renderTimelineEntryDeferred(...) - use text system to find name of entity
    workflow.renderTimelineEntryDeferred(function(M, entry) {
        var data = JSON.parse(entry.json);
        if(entry.action === 'ENTITY_REPLACE') {
            var action = data.replacement ? 'replaced' : 'removed-replacement';
            var actionText = M._getTextMaybe(['entity-replacement:timeline-text'], [action]) || "changed the";
            var n;
            if(data.replacement) {
                n = O.ref(data.replacement).load().title;
            }
            return P.template("timeline/entity-replace").deferredRender({
                entry: entry,
                set: !!data.replacement,
                actionText: actionText,
                entityName: M._getText(['entity-replacement:display-name'], data.entityName),
                replacement: n
            });
        }
        if(entry.action === 'ENTITY_SELECT') {
            return P.template("timeline/entity-select").deferredRender({
                entry: entry,
                selected: _.map(data.selected, function(entity) { return M._getText(['entity-replacement:display-name'], [entity]); })
            });
        }
    });

    // Function to get the URL of the replacements UI: M.entityReplacementUserInterfaceURL()
    workflow.$instanceClass.prototype.entityReplacementUserInterfaceURL = function() {
        return "/do/workflow/entity-replacement/"+this.workUnit.id;
    };

    workflow.modifyFlags(function(M, flags) {
        var set = _.keys(flags);
        for(var i = 0; i < set.length; i++) {
            if(set[i].indexOf("entity-replacement:selected") !== -1) {
                delete flags[set[i]];
            }
        }
        var timelineQuery = M.timelineSelect().where("action", "=", "ENTITY_SELECT").order("datetime","desc");
        if(timelineQuery.length > 0) {
            var selected = JSON.parse(timelineQuery[0].json).selected;
            _.each(selected, function(s) {
                flags["entity-replacement:selected:"+s] = true;
            });
        }
    });

});

var ensureDbRowsCreated = function(workflow, M) {
    // Ensure database row created for each entity in the list
    var dbName = 'stdworkflowEr'+P.workflowNameToDatabaseTableFragment(workflow.name);
    _.each(workflow.$entityReplacementSpecification.replacements, function(info, name) {
        var unreplacedName = info.entity;
        // TODO: use listAll to be more efficient with db space
        _.each(M.entities[unreplacedName+'_refList'], function(ref) {
            var dbQuery = workflow.plugin.db[dbName].select().
                    where("workUnitId", "=", M.workUnit.id).
                    where("entity", "=", ref).
                    where("name", "=", unreplacedName);
            if(!dbQuery.count()) {
                workflow.plugin.db[dbName].create({
                    workUnitId: M.workUnit.id,
                    name: unreplacedName,
                    entity: ref,
                    selected: true      // Default
                }).save();
            }
        });
    });
};

var makeNamesForTypes = function(types) {
    var suffix = types.map(function(t) { return t.toString(); }).join('_');
    return {
        form: "entityReplacementForm_"+suffix,
        lookup: "entityReplacement_"+suffix
    };
};

// TODO: This needs refactoring as relevance is now stored in the database
// Return an array?
var findCurrentlyReplaceable = function(workflow, M, specification) {
    ensureDbRowsCreated(workflow, M);
    var dbName = 'stdworkflowEr'+P.workflowNameToDatabaseTableFragment(workflow.name);
    var selected = workflow.plugin.db[dbName].select().
            where("workUnitId", "=", M.workUnit.id).
            where("selected", "=", true);
    var selectedSpec = {};
    _.each(selected, function(rr) {
        var rep = _.find(specification.replacements, function(s) {
            return (s.entity === rr.name);
        });
        if(M.selected(rep.assignableWhen)) {
            selectedSpec[rr.name] = rep;
        }
    });
    return selectedSpec;
};

var findCurrentlySelectable = function(M, specification) {
    return _.filter(specification.replacements, function(spec) {
        return (spec.selectableWhen && M.selected(spec.selectableWhen));
    });
};

var makeEntityReplacementForm = function(formName, dataSource) {
    return P.form({
        specificationVersion: 0,
        formId: formName,
        formTitle: "Entity Replacement",
        elements: [
            {
                type: "lookup",
                path: "replacement",
                dataSource: dataSource
            }
        ]
    });
};

P.respond("GET,POST", "/do/workflow/entity-replacement", [
    {pathElement:0, as:"workUnit"}
], function(E, workUnit) {
    var workflow = P.allWorkflows[workUnit.workType];
    if(!workflow) { O.stop("Workflow not implemented"); }
    var M = workflow.instance(workUnit);
    ensureDbRowsCreated(workflow, M);

    var specification = workflow.$entityReplacementSpecification;
    var data = [];

    var dbName = 'stdworkflowEr'+P.workflowNameToDatabaseTableFragment(workflow.name);
    var dbQuery = workflow.plugin.db[dbName].select().where('workUnitId', '=', workUnit.id);

    if(E.request.method === "POST") {
        var selected = [];
        dbQuery.each(function(row) {
            row.selected = false;
            _.each(E.request.parameters, function(value, entity) {
                if((row.name === entity) && (row.entity.toString() in value)) {
                    row.selected = true;
                    selected.push(row.name);
                }
            });
            row.save();
        });
        M.addTimelineEntry('ENTITY_SELECT', {
            selected: selected
        });
        M._calculateFlags();
        E.response.redirect("/do/workflow/entity-replacement/"+workUnit.id);
    }

    _.each(specification.replacements, function(spec, entity) {
        var originalEntityName = spec.entity;
        var path = originalEntityName.replace(/([A-Z])/g, function(m) { return '-'+m.toLowerCase(); });
        var suffix = (spec.listAll ? '_refList' : '_ref');
        _.each([].concat(M.entities[originalEntityName+suffix]), function(ref) {
            var row = _.find(dbQuery, function(r) {
                return (r.entity == ref && r.name === originalEntityName);
            });
            data.push({
                title: M._getText(['entity-replacement:display-name'], [originalEntityName]),
                original: ref,
                replacement: row.replacement ? row.replacement.load() : undefined,
                entityName: originalEntityName,
                assignable: M.selected(spec.assignableWhen),
                selectable: (spec.selectableWhen && M.selected(spec.selectableWhen)),
                selected: row.selected,
                editPath: "/do/workflow/replace/"+workUnit.id+"/"+path+"/"+ref.toString()
            });
        });
    });
    if("onFinishPage" in specification) {
        var link = specification.onFinishPage(M);
        if(link) {
            E.renderIntoSidebar({
                elements: [{ href: link, label: "Continue", indicator: "primary" }]
            }, "std:ui:panel");
        }
    }
    E.render({
        pageTitle: M._getTextMaybe(['entity-replacement:ui:page-title'], ['summary']) || "Replacements summary",
        backLink: M.entities.object.url(),
        data: data
    }, "entity-replacements/overview");
});

P.respond("GET,POST", "/do/workflow/replace", [
    {pathElement:0, as:"workUnit"},
    {pathElement:1, as:"string"},
    {pathElement:2, as:"object"}
], function(E, workUnit, path, original) {
    var workflow = P.allWorkflows[workUnit.workType];
    if(!workflow) { O.stop("Workflow not implemented"); }
    var M = workflow.instance(workUnit);
    // Conversion from url scheme to camelcase
    var entityName = path.replace(/(\-[a-z])/g, function(m) { return m.replace('-', '').toUpperCase(); });
    var replacementEntityName;
    var info = _.find(findCurrentlyReplaceable(workflow, M, workflow.$entityReplacementSpecification), function(value, key) {
        if(value.entity === entityName) {
            replacementEntityName = key;
            return true;
        }
    });
    if(!info) { O.stop("Entity "+entityName+" is not replaceable."); }

    var dbName = 'stdworkflowEr'+P.workflowNameToDatabaseTableFragment(workflow.name);
    var dbRow = workflow.plugin.db[dbName].select().
            where('workUnitId', '=', workUnit.id).
            where('name', '=', entityName).
            where('entity', '=', original.ref)[0];
    var document = { replacement: dbRow.replacement || undefined }; // to prevent calling toString() on null when rendering

    var formName = makeNamesForTypes(info.replacementTypes).form;
    var formDesc = chooseReplacementForms[formName];
    var form = formDesc.handle(document, E.request);
    if(E.request.method === "POST") {
        dbRow.replacement = document.replacement ? O.ref(document.replacement) : null;
        dbRow.save();
        M.addTimelineEntry('ENTITY_REPLACE', {
            entityName: entityName,
            replacement: document.replacement
        });
        // Relabel object for permissions
        if(O.serviceImplemented("std:workflow:entities:replacement_changed")) {
            O.service("std:workflow:entities:replacement_changed", M.workUnit.ref.load(), workflow.fullName, replacementEntityName);
        }
        return E.response.redirect("/do/workflow/entity-replacement/"+M.workUnit.id);
    }

    E.render({
        pageTitle: (M._getTextMaybe(['entity-replacement:ui:page-title'], ['form']) || "Replacement")+
                    ": "+M._getText(['entity-replacement:display-name'], [entityName]),
        backLink: "/do/workflow/entity-replacement/"+workUnit.id,
        entityDisplayName: M._getText(['entity-replacement:display-name'], [entityName]),
        originalEntityTitle: original.title,
        form: form
    }, "entity-replacements/form");    
});

