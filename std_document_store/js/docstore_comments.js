
// checkPermissions called with key & action, where action is 'addComment' or 'viewComments'

P.implementService("std:document_store:comments:respond", function(E, docstore, key, checkPermissions) {
    E.response.kind = 'json';

    // Check permission
    if(!checkPermissions(key, (E.request.method === "POST") ? 'addComment' : 'viewComments')) {
        E.response.body = JSON.stringify({result:"error",message:"Permission denied"});
        E.response.statusCode = HTTP.UNAUTHORIZED;
        return;
    }

    var instance = docstore.instance(key);
    var response = {result:"success"};

    if(E.request.method === "POST") {
        // Add a comment for this user
        var version = parseInt(E.request.parameters.version,10),
            formId = E.request.parameters.form,
            elementUName = E.request.parameters.uname,
            comment = E.request.parameters.comment;
        if(!(version && formId && elementUName && comment && (formId.length < 200) && (elementUName.length < 200) && (comment.length < 131072))) {
            response.result = "error";
            response.method = "Bad parameters";
        } else {
            var row = docstore.commentsTable.create({
                keyId: instance.keyId,
                version: version,
                userId: O.currentUser.id,
                formId: formId,
                elementUName: elementUName,
                comment: comment
            });
            response.id = row.id;
        }

    } else {
        // Return all comments for this document
        var users = {}, forms = {};
        _.each(docstore.commentsTable.select().where("keyId","=",instance.keyId), function(row) {
            var form = forms[row.formId];
            if(!form) { form = forms[row.formId] = {}; }
            var comments = form[row.elementUName];
            if(!comments) { comments = form[row.elementUName] = []; }
            var uid = row.userId;
            comments.push({
                id: row.id,
                uid: uid,
                version: row.version,
                comment: row.comment
            });
            if(!users[uid]) {
                users[uid] = O.user(uid).name;
            }
        });
        response.users = users;
        response.forms = forms;
    }

    E.response.body = JSON.stringify(response);
});
