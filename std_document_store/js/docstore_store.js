/* Haplo Platform                                     http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var DocumentInstance = P.DocumentInstance;

var storeNameToDatabaseTableFragment = function(name) {
    // Encode the database name using a stable transform which only uses a-zA-X0-9
    return name.replace(/([^a-zA-Y])/g, function(match, p1) { return 'X'+p1.charCodeAt(0); });
};

// ----------------------------------------------------------------------------

var DocumentStore = P.DocumentStore = function(P, delegate) {
    this.delegate = delegate;
    // Define databases
    var dbNameFragment = storeNameToDatabaseTableFragment(delegate.name);
    var currentDbName = "dsCurrent"+dbNameFragment;
    var versionsDbName = "dsVersions"+dbNameFragment;
    P.db.table(currentDbName, {
        keyId:      { type:delegate.keyIdType || "int", indexed:true, uniqueIndex:true },
        json:       { type:"text" },
        complete:   { type:"boolean" }
    });
    P.db.table(versionsDbName, {
        keyId:      { type:delegate.keyIdType || "int", indexed:true },
        json:       { type:"text" },
        // When this version was committed (as milliseconds past epoch)
        version:    { type:"bigint" },
        // Which user committed this version
        user:       { type:"user" }
    });
    // Keep references to the databases
    this.currentTable = P.db[currentDbName];
    this.versionsTable = P.db[versionsDbName];
    // Create comments table, if in use by this document store
    this.enablePerElementComments = delegate.enablePerElementComments;
    if(this.enablePerElementComments) {
        var commentsDbName = "dsComment"+dbNameFragment;
        P.db.table(commentsDbName, {
            keyId:        { type:delegate.keyIdType || "int", indexed:true, indexedWith:"datetime" },
            version:      { type:"bigint" },
            userId:       { type:"int" },   // don't use 'user' to avoid unnecessary creation of user objects
            datetime:     { type:"datetime"},
            formId:       { type:"text" },
            elementUName: { type:"text" },
            comment:      { type:"text" },
            isPrivate:    { type:"boolean", nullable:true }, // may be null if private comments aren't enabled
            // supersededBy only set if the comment was edited
            supersededBy: { type:"int", nullable:true},
            commentFlags: { type:"json", nullable:true},
            lastEditedBy: { type:"int", nullable:true }
        });
        this.commentsTable = P.db[commentsDbName];
    }
};

// ----------------------------------------------------------------------------

DocumentStore.prototype.instance = function(key) {
    return new DocumentInstance(this, key);
};

DocumentStore.prototype._keyToKeyId = function(key) {
    return this.delegate.keyToKeyId ? this.delegate.keyToKeyId(key) : key;
};

DocumentStore.prototype._blankDocumentForKey = function(key) {
    return (this.delegate.blankDocumentForKey ? this.delegate.blankDocumentForKey(key) :
        undefined) || {};
};

DocumentStore.prototype._formsForKey = function(key, instance, proposedDocument) {
    return this.delegate.formsForKey(key, instance, proposedDocument || instance.currentDocument);
};

DocumentStore.prototype._formIdFromRequest = function(request) {
    return this.delegate.formIdFromRequest ?
        this.delegate.formIdFromRequest(request) :
        request.extraPathElements[1]; // Assumes URLs of the form /do/.../<someId>/<formId>
};

DocumentStore.prototype._updateDocumentBeforeEdit = function(key, instance, document) {
    return (this.delegate.updateDocumentBeforeEdit ? this.delegate.updateDocumentBeforeEdit(key, instance, document) :
        undefined);
};
