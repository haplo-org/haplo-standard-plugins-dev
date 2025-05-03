/* Haplo Platform                                     http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Options:
//    version - version number to display (overrides version)
//    showVersions - true to allow user to select a version to view
//    showCurrent - allow the user to see the current version
//    viewComments - show comments in this viewer
//    addComment - user is allowed to add comments
//    commentsUrl - path of comment server (required if viewComments or addComment is true)
//    hideFormNavigation - hide the interform links from the sidebar
//    uncommittedChangesWarningText - specify (or disable) the uncommitted changes warning text
//    style - specify the style of the viewer
//        currently only "tabs" supported, splits forms into tabs instead of showing on one page

var DocumentViewer = P.DocumentViewer = function(instance, E, options) {
    this.instance = instance;
    this.E = E;
    this.options = options || {};

    var store = instance.store;

    var currentParams = E.request.parameters;
    this.currentParams = currentParams;
    this.url = this.options.url;
    // Requested version?
    if("version" in this.options) {
        this.version = this.options.version;
    } else if(this.options.showVersions && ("version" in E.request.parameters)) {
        var vstr = E.request.parameters.version;
        this.version = (vstr === '') ? undefined : parseInt(vstr,10);
    }
    // Requested change?
    if("showChangesFrom" in this.options) {
        this.showChangesFrom = this.options.showChangesFrom;
    } else if(this.options.showVersions) {
        if(!E.request.parameters.from) {
            var v = store.versionsTable.select().
                where("keyId","=",instance.keyId).
                order("version",true).
                limit(2); // because non-versioned number needs 2
            if(this.version) {
                v.where("version","<",this.version);
                if(v.length) { this.showChangesFrom = v[0].version; }
            } else {
                if(instance.currentDocumentIsEdited && v.length) { this.showChangesFrom = v[0].version; }
                else if(v.length > 1) { this.showChangesFrom = v[1].version; }
            }
        } else {
            this.showChangesFrom = parseInt(E.request.parameters.from, 10);
        }
    }

    if("style" in this.options) {
        this.style = this.options.style;
        this.options.hideFormNavigation = true;
        if(this.style === "tabs") {
            var selectedFormId = this.selectedFormId = E.request.parameters.form;
            var tabs = this.tabs = [];
            _.each(instance.forms, function(form, index) {
                var selected = (!selectedFormId && index === 0) || (selectedFormId === form.formId);
                tabs.push({
                    href: instance.keyId,
                    parameters: {form: form.formId},
                    label: form.formTitle,
                    selected: selected
                });
            });
        }
    }

    // Is there a current version of the document?
    var current = store.currentTable.select().where("keyId","=",instance.keyId);
    if(current.length > 0) {
        this.haveCurrent = true;
        // Should it be used as the document to render?
        if(!this.version && this.options.showCurrent) {
            this.document = JSON.parse(current[0].json);
            this.showingCurrent = true;
        }
    }

    // If the current document isn't the one to display, select the requested
    // version or use the latest version
    if(!this.document) {
        var requestedVersion = store.versionsTable.select().
            where("keyId","=",instance.keyId).order("version",true).limit(1);
        if(this.version) { requestedVersion.where("version","=",this.version); }
        if(requestedVersion.length === 0 && (this.version)) {
            O.stop("Requested version does not exist");
        }
        if(requestedVersion.length > 0) {
            this.document = JSON.parse(requestedVersion[0].json);
            this.version = requestedVersion[0].version;
        }
    }

    // Retrieve the "previous" version?
    if(this.showChangesFrom) {
        var requestedPrevious = store.versionsTable.select().
            where("keyId","=",instance.keyId).
            where("version","=",this.showChangesFrom).
            limit(1);
        if(requestedPrevious.length === 0) {
            O.stop("Requested previous version does not exist");
        }
        this.showChangesFromDocument = JSON.parse(requestedPrevious[0].json);
    }

    // Commenting? (but only if we're not showing changes)
    if(this.options.viewComments || this.options.addComment) {
        this.requiresComments = true;
        if(!this.options.commentsUrl) {
            throw new Error("viewComments or addComment used in docstore viewer, but commentsUrl not specified");
        }
        this.versionForComments = this.version;
        if(!this.versionForComments) {
            this.versionForComments = instance.committedVersionNumber;
        }
        if(!this.versionForComments) {
            this.requiresComments = false;  // disable if there isn't a committed version yet, so won't have comments anyway
        }
        // Don't want to clutter up display of final versions, so comments can be turned off
        if(this.requiresComments && this.options.hideCommentsByDefault && !currentParams.comment) {
            this.requiresComments = false;  // just turn it all off
            var numberOfComments = store.commentsTable.select().
                where("keyId","=",instance.keyId).
                count();
            if(numberOfComments > 0) {
                this.couldShowNumberOfComments = numberOfComments;
            }
        }
    }
    this.canFilter = currentParams.comment || currentParams.changes; // can only filter if have something to look at
    this.showChanges = currentParams.changes && this.showChangesFrom;
    // Get any additional UI to display
    var delegate = this.instance.store.delegate;
    if(delegate.showTransitionInDocument) {
        if(!this.version) { return; }
        let submitted = new XDate(this.version);
        let M = this.instance.key;
        let timelineQuery = M.timelineSelect().order("datetime", true).
            where("datetime", ">=", submitted).
            or((sq) => {
                _.each(delegate.showTransitionInDocument, (state) => {
                    sq.where("previousState", "=", state);
                });
            });
        let timelineEntry = timelineQuery.length ? timelineQuery[0] : undefined;
        if(timelineEntry) {
            this.transitionDeferredRender = P.template("std:ui:choose:selected-item").deferredRender({
                label: M.getTextMaybe("transition:"+timelineEntry.action),
                indicator: M.getTextMaybe("transition-indicator:"+timelineEntry.action, "transition-indicator"),
                notes: M.getTextMaybe("transition-notes:"+timelineEntry.action)
            });
        }
    }
    if(delegate.getAdditionalUIForViewer) {
        this.additionalUI = delegate.getAdditionalUIForViewer(this.instance.key, this.instance, this.document);
    }
};

// ----------------------------------------------------------------------------

DocumentViewer.prototype.__defineGetter__("hasDocumentToDisplay", function() {
    return !!(this.document);
});

DocumentViewer.prototype.__defineGetter__("documentHTML", function() {
    return P.template("viewer").render(this);
});

DocumentViewer.prototype.__defineGetter__("deferredDocument", function() {
    return P.template("viewer").deferredRender(this);
});

DocumentViewer.prototype.__defineGetter__("sidebarHTML", function() {
    return P.template("viewer_sidebar").render(this);
});

// ----------------------------------------------------------------------------

DocumentViewer.prototype.__defineGetter__("_viewerForms", function() {
    return this.instance._displayForms(this.document, this.version);
});

DocumentViewer.prototype.__defineGetter__("_viewerBody", function() {
    var viewerBodyTemplate = this.style ? "viewer_body_"+this.style : "viewer_body";
    return P.template(viewerBodyTemplate).deferredRender(this);
});

DocumentViewer.prototype.__defineGetter__("_viewerDocumentDeferred", function() {
    return this.instance._renderDocument(this.document, true, undefined, this.requiresComments /* so needs unames */, this.version);
});

DocumentViewer.prototype.__defineGetter__("_viewerSelectedForm", function() {
    return this.instance._selectedFormInfo(this.document, this.selectedFormId, this.version);
});

DocumentViewer.prototype.__defineGetter__("_viewerShowChangesFromDocumentDeferred", function() {
    return this.instance._renderDocument(this.showChangesFromDocument, true, '_prev_', this.requiresComments /* so needs unames */, this.version);
});

DocumentViewer.prototype.__defineGetter__("_uncommittedChangesWarningText", function() {
    let i = P.locale().text("template");
    return (this.options.uncommittedChangesWarningText === undefined) ?
        i["You've made some changes, but they're not visible to anyone else yet."] :
        this.options.uncommittedChangesWarningText;
});

DocumentViewer.prototype.__defineGetter__("_versionsView", function() {
    // NOTE: Versions selector view is derived from this view
    var viewer = this;
    if("$_versionsView" in this) { return this.$_versionsView; }
    var versions = _.map(viewer.instance.store.versionsTable.select().
        where("keyId","=",viewer.instance.keyId).order("version",true), function(row) {
            return {
                row: row,
                datetime: new Date(row.version),
                selected: (row.version === viewer.version)
            };
        }
    );
    if(viewer.options.showCurrent && viewer.haveCurrent) {
        versions.unshift({
            editedVersion: true,
            selected: viewer.showingCurrent
        });
    }
    this.$_versionsView = versions; // cached because versions uses this too
    return versions;
});

DocumentViewer.prototype.__defineGetter__("_changesVersionView", function() {
    if(!this.options.showVersions) { return []; }
    if("$_changesVersionView" in this) { return this.$_changesVersionView; }
    var vv = this._versionsView; // cached
    var options = [];
    var changesVersion = this.showChangesFrom;
    var selectedVersion = this.version;
    vv.forEach(function(version) {
        // selectedVersion is undefined if it is being edited, but then it will be the latest
        if(!version.editedVersion && (!selectedVersion || version.row.version < selectedVersion)) {
            options.push({
                row: version.row,
                selected: changesVersion === version.row.version,
                datetime: version.datetime
            });
        }
    });
    this.$_changesVersionView = options;
    return options;
});

DocumentViewer.prototype.__defineGetter__("_showFormNavigation", function() {
    return (this.instance.forms.length > 1) && !(this.options.hideFormNavigation);
});
