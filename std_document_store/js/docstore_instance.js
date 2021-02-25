/* Haplo Platform                                     http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var DocumentInstance = P.DocumentInstance = function(store, key) {
    this.store = store;
    this.key = key;
    this.keyId = store._keyToKeyId(key);
};

// ----------------------------------------------------------------------------

DocumentInstance.prototype.__defineGetter__("forms", function() {
    // Don't cache the forms, so they can change as forms are committed
    return this.store._formsForKey(this.key, this);
});

DocumentInstance.prototype.__defineGetter__("currentDocument", function() {
    // Cached?
    var document = this.$currentDocument;
    if(document) { return document; }
    // Try current version first
    var current = this.store.currentTable.select().where("keyId","=",this.keyId);
    if(current.length > 0) {
        document = JSON.parse(current[0].json);
    }
    // Fall back to last committed version or a blank document
    if(document === undefined) {
        document = this.lastCommittedDocument;
    }
    // Cache found document
    this.$currentDocument = document;
    return document;
});

// Are there some edits outstanding?
DocumentInstance.prototype.__defineGetter__("currentDocumentIsEdited", function() {
    return this.store.currentTable.select().where("keyId","=",this.keyId).length > 0;
});

// If there isn't a current document, check the committed version
DocumentInstance.prototype.__defineGetter__("currentDocumentIsComplete", function() {
    var current = this.store.currentTable.select().where("keyId","=",this.keyId);
    if(current.length > 0) {
        return current[0].complete;
    }
    return this.committedDocumentIsComplete;
});

DocumentInstance.prototype.__defineGetter__("committedDocumentIsComplete", function() {
    var committed = this.store.versionsTable.select().
        where("keyId","=",this.keyId).
        order("version", true).
        limit(1);
    var instance = this;
    if(committed.length > 0) {
        var record = committed[0];
        var document = JSON.parse(record.json);
        var isComplete = true;
        var forms = this._editForms(document);
        _.each(forms, function(form) {
            var formInstance = form.instance(document);
            formInstance.externalData(instance._formExternalData());
            if(!formInstance.documentWouldValidate()) {
                isComplete = false;
            }
        });
        return isComplete;
    } else {
        return false;
    }
});

DocumentInstance.prototype.__defineGetter__("committedVersionNumber", function() {
    var latest = this.store.versionsTable.select().
        where("keyId","=",this.keyId).
        order("version", true).
        limit(1);
    return latest.length ? latest[0].version : undefined;
});

DocumentInstance.prototype._notifyDelegate = function(fn) {
    var delegate = this.store.delegate;
    if(delegate[fn]) {
        var functionArguments = Array.prototype.slice.call(arguments, 0);
        functionArguments[0] = this;
        delegate[fn].apply(delegate, functionArguments);
    }
};

DocumentInstance.prototype._formExternalData = function() {
    return {
        "std_document_store:store": this.store,
        "std_document_store:instance": this,
        "std_document_store:key": this.key
    };
};

// ----------------------------------------------------------------------------

DocumentInstance.prototype.setCurrentDocument = function(document, isComplete) {
    var json = JSON.stringify(document);
    var current = this.store.currentTable.select().where("keyId","=",this.keyId);
    var row = (current.length > 0) ? current[0] :
        this.store.currentTable.create({keyId:this.keyId});
    row.json = json;
    row.complete = isComplete;
    row.save();
    // Invalidate cached current document (don't store given document because we don't own it)
    delete this.$currentDocument;
    this._notifyDelegate('onSetCurrentDocument', document, isComplete);
};

DocumentInstance.prototype.__defineSetter__("currentDocument", function(document) {
    this.setCurrentDocument(document, true /* assume complete */);
});

// ----------------------------------------------------------------------------

// Returns a blank document is there isn't a last committed version
DocumentInstance.prototype.__defineGetter__("lastCommittedDocument", function() {
    var lastVersion = this.store.versionsTable.select().
        where("keyId","=",this.keyId).order("version",true).limit(1);
    return (lastVersion.length > 0) ? JSON.parse(lastVersion[0].json) :
        this.store._blankDocumentForKey(this.key);
});

DocumentInstance.prototype.__defineGetter__("hasCommittedDocument", function() {
    return (0 < this.store.versionsTable.select().where("keyId","=",this.keyId).
        order("version",true).limit(1).length);
});

// ----------------------------------------------------------------------------

DocumentInstance.prototype.__defineGetter__("history", function() {
    return _.map(this.store.versionsTable.select().where("keyId","=",this.keyId).
        order("version"), function(row) {
            return {
                version: row.version,
                date: new Date(row.version),
                user: row.user,
                document: JSON.parse(row.json)
            };
        }
    );
});

// DEPRECATED: use instance.history
DocumentInstance.prototype.getAllVersions = function() { return this.history; };

// ----------------------------------------------------------------------------

// Commit the editing version, maybe duplicating the last version or committing
// a blank document
DocumentInstance.prototype.commit = function(user) {
    // Invalidate current document cache
    delete this.$currentDocument;
    // Get JSON directly from current version?
    var current = this.store.currentTable.select().where("keyId","=",this.keyId);
    var json  = (current.length > 0) ? current[0].json : undefined;
    // Create a new version, if no current JSON, fall back to lastCommittedDocument
    // which may just be a blank document.
    this.store.versionsTable.create({
        keyId: this.keyId,
        json: json || JSON.stringify(this.lastCommittedDocument),
        version: Date.now(),
        user: user || O.currentUser
    }).save();
    // Delete any last version
    if(current.length > 0) {
        current[0].deleteObject();
    }
    this._notifyDelegate('onCommit', user);
};

DocumentInstance.prototype.addInitialCommittedDocument = function(document, user, date) {
    // ensure that other documents don't already exist
    const current = this.store.currentTable.select().where("keyId", "=", this.keyId);
    const versions = this.store.versionsTable.select().where("keyId", "=", this.keyId);
    if(current.length || versions.length) { throw new Error("Cannot add initial document because there is already a document for this key."); }
    // don't want to call onCommit delegate because would be repeating actions that have already occurred
    this.store.versionsTable.create({
        keyId: this.keyId,
        json: JSON.stringify(document),
        version: date.getTime(),
        user: user
    }).save();
};

// ----------------------------------------------------------------------------

DocumentInstance.prototype._displayForms = function(document) {
    var delegate = this.store.delegate;
    var key = this.key;
    var unfilteredForms = this.store._formsForKey(key, this, document);
    if(!delegate.shouldDisplayForm) { return unfilteredForms; }
    return _.filter(unfilteredForms, function(form) {
        return (delegate.shouldDisplayForm(key, form, document || this.currentDocument));
    });
};

DocumentInstance.prototype._editForms = function(document) {
    var delegate = this.store.delegate;
    var key = this.key;
    var unfilteredForms = this.store._formsForKey(key, this, document);
    if(!delegate.shouldEditForm) { return unfilteredForms; }
    return _.filter(unfilteredForms, function(form) {
        return (delegate.shouldEditForm(key, form, document || this.currentDocument));
    });
};

// Render as document
DocumentInstance.prototype._renderDocument = function(document, deferred, idPrefix, requiresUNames) {
    var html = [];
    var delegate = this.store.delegate;
    var dsInstance = this;
    var key = this.key;
    var sections = [];
    var forms = this._displayForms(document);
    idPrefix = idPrefix || '';
    _.each(forms, function(form) {
        var instance = form.instance(document);
        instance.externalData(dsInstance._formExternalData());
        if(requiresUNames) { instance.setIncludeUniqueElementNamesInHTML(true); }
        if(delegate.prepareFormInstance) {
            delegate.prepareFormInstance(key, form, instance, "document");
        }
        sections.push({
            unsafeId: idPrefix+form.formId,
            title: form.formTitle,
            instance: instance
        });
    });
    var view = {sections:sections};
    var t = P.template("all_form_documents");
    return deferred ? t.deferredRender(view) : t.render(view);
};

DocumentInstance.prototype._selectedFormInfo = function(document, selectedFormId) {
    var delegate = this.store.delegate;
    var key = this.key;
    var forms = this.forms, form;
    if(selectedFormId) {
        form = _.find(forms, function(form) {
            return selectedFormId === form.formId;
        });
    }
    if(!form) { form = forms[0]; }
    var instance = form.instance(document);
    instance.externalData(this._formExternalData());
    if(delegate.prepareFormInstance) {
        delegate.prepareFormInstance(key, form, instance, "document");
    }
    return {
        title: form.formTitle,
        instance: instance
    };
};

DocumentInstance.prototype.__defineGetter__("lastCommittedDocumentHTML", function() {
    return this._renderDocument(this.lastCommittedDocument);
});
DocumentInstance.prototype.deferredRenderLastCommittedDocument = function() {
    return this._renderDocument(this.lastCommittedDocument, true);
};

DocumentInstance.prototype.__defineGetter__("currentDocumentHTML",       function() {
    return this._renderDocument(this.currentDocument);
});
DocumentInstance.prototype.deferredRenderCurrentDocument = function() {
    return this._renderDocument(this.currentDocument, true);
};

// ----------------------------------------------------------------------------

// Edit current document
DocumentInstance.prototype.handleEditDocument = function(E, actions) {
    // The form ID is encoded into the request somehow
    var untrustedRequestedFormId = this.store._formIdFromRequest(E.request);
    // Is this the special form incomplete page?
    var renderingFormIncompletePage = (untrustedRequestedFormId === "__incomplete");
    // Set up information about the pages
    var instance = this,
        delegate = this.store.delegate,
        cdocument = this.currentDocument,
        requiresUNames = !!actions.viewComments,
        forms,
        pages, isSinglePage,
        activePage,
        pagesWithComments = [],
        version = instance.committedVersionNumber;
    instance.store._updateDocumentBeforeEdit(instance.key, instance, cdocument);
    if(instance.store.enablePerElementComments) {
        pagesWithComments = instance.store.commentsTable.select().where("keyId", "=", instance.keyId).
            where("isPrivate", "<>", true).aggregate("COUNT", "id", "formId");
        pagesWithComments = _.pluck(pagesWithComments, "group");
    }
    var updatePages = function() {
        forms = actions._showAllForms ? instance.store._formsForKey(instance.key, instance, cdocument) : instance._editForms(cdocument);
        if(forms.length === 0) { throw new Error("No form definitions"); }
        pages = [];
        for(var i = 0; i < forms.length; ++i) {
            var form = forms[i],
                formInstance = form.instance(cdocument);
            formInstance.externalData(instance._formExternalData());
            if(requiresUNames) { formInstance.setIncludeUniqueElementNamesInHTML(true); }
            if(delegate.prepareFormInstance) {
                delegate.prepareFormInstance(instance.key, form, formInstance, "form");
            }
            var hasComments = pagesWithComments.indexOf(form.formId) !== -1;
            pages.push({
                index: i,
                form: form,
                instance: formInstance,
                complete: formInstance.documentWouldValidate(),
                hasComments: hasComments
            });
            if(form.formId === untrustedRequestedFormId) {
                activePage = pages[i];
            }
        }
        pages[pages.length - 1].isLastPage = true;
        isSinglePage = (pages.length === 1);
    };
    updatePages();
    var getGotoPage = function() {
        return _.find(pages, function(p) {
            return p.form.formId === E.request.parameters.__goto;
        });
    };
    // Handle the special case of the incomplete overview seperately
    if(renderingFormIncompletePage) {
        if(E.request.parameters.__later === "s") {
            return actions.finishEditing(this, E, false /* not complete */);
        }
        // Duplicate the .gotoPage() call from below to be able to do it without
        // updating the document (incomplete page has no form)
        var gotoPageIncomplete = getGotoPage();
        if(gotoPageIncomplete) { return actions.gotoPage(this, E, gotoPageIncomplete.form.formId); }
    } else {
        // Default the active page to the first page
        if(!activePage) { activePage = pages[0]; }
        activePage.active = true;
    }
    // What happens next?
    var showFormError = false;
    if(!renderingFormIncompletePage && E.request.method === "POST") {
        // Update from the active form
        activePage.instance.update(E.request);
        activePage.complete = activePage.instance.complete;
        if(activePage.complete) {
            // delegate.formsForKey() may return different forms now document has changed
            updatePages();
        }
        var firstIncompletePage = _.find(pages, function(p) { return !p.complete; });
        if(!this.hasCommittedDocument || this.currentDocumentIsEdited || !_.isEqual(cdocument, this.lastCommittedDocument)) {
            this.setCurrentDocument(cdocument, !(firstIncompletePage) /* all complete? */);
        }
        // Goto another form?
        var gotoPage = getGotoPage();
        if(gotoPage) {
            return actions.gotoPage(this, E, gotoPage.form.formId);
        } else {
            // If user clicked 'save for later', stop now
            if(E.request.parameters.__later === "s") {
                return actions.finishEditing(this, E, false /* not complete */);
            }
            // If the form is complete, go to the next form, or finish
            if(activePage.complete) {
                // Find next page, remembering indexes might have changed
                var nextIndex = -1, activeFormId = activePage.form.formId;
                for(var l = 0; l < pages.length; ++l) {
                    if(pages[l].form.formId === activeFormId) {
                        nextIndex = l+1;
                        break;
                    }
                }
                if(nextIndex >= 0 && nextIndex >= pages.length) {
                    if(firstIncompletePage) {
                        // goto checklist/show incomplete overview page
                        // renderingFormIncompletePage = true;
                        actions.gotoPage(this, E, "__incomplete");
                    } else {
                        return actions.finishEditing(this, E, true /* everything complete */);
                    }
                } else {
                    return actions.gotoPage(this, E,
                        pages[nextIndex].form.formId);
                }
            } else {
                showFormError = true;
            }
        }
    }
    // Render the form
    var navigationTop = null, navigationBottom = null;
    if(!isSinglePage || (delegate.alwaysShowNavigation && delegate.alwaysShowNavigation(this.key, this, cdocument))) {
        var navigationTemplate = P.template("navigation");
        navigationTop = navigationTemplate.deferredRender({pages:pages});
        navigationBottom = navigationTemplate.deferredRender({pages:pages, isRepeat:true});
    }
    if(renderingFormIncompletePage) {
        // slightly abuse form render action to show a list of 'incomplete' forms
        // when the user tries to submit the last page with incomplete prior pages
        actions.render(this, E, P.template("incomplete").deferredRender({
            isSinglePage: isSinglePage,
            navigationTop: navigationTop,
            navigationBottom: navigationBottom,
            pages: pages
        }));
    } else {
        var additionalUI;
        if(delegate.getAdditionalUIForEditor) {
            additionalUI = delegate.getAdditionalUIForEditor(instance.key, instance, cdocument, activePage.form);
        }
        var saveButtonStyle = "continue";
        if(!delegate.__formSubmissionDoesNotCompleteProcess) {
            if(isSinglePage) {
                saveButtonStyle = "save";
            } else if(activePage.isLastPage) {
                saveButtonStyle = "finish";
            }
        }
        actions.render(this, E, P.template("edit").deferredRender({
            isSinglePage: isSinglePage,
            viewComments: actions.viewComments,
            commentsUrl: actions.commentsUrl,
            versionForComments: actions.viewComments ? this.committedVersionNumber : undefined,
            saveButtonStyle: saveButtonStyle,
            saveButtonLabel: "saveButtonLabel" in delegate ? delegate.saveButtonLabel(saveButtonStyle) : undefined,
            saveForLaterButtonLabel: "saveForLaterButtonLabel" in delegate ? delegate.saveForLaterButtonLabel() : undefined,
            navigationTop: navigationTop,
            navigationBottom: navigationBottom,
            showFormTitles: actions.showFormTitlesWhenEditing,
            pages: pages,
            showFormError: showFormError,
            additionalUI: additionalUI,
            activePage: activePage
        }));
    }
};

// ----------------------------------------------------------------------------

// Viewer UI
DocumentInstance.prototype.makeViewerUI = function(E, options) {
    return new P.DocumentViewer(this, E, options);
};
