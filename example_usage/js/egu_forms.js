// Forms documentation: https://docs.haplo.org/plugin/form
var form0 = P.form("exForm0", "form/form0.json");
var form1 = P.form("exForm1", "form/form1.json");

// Document store documentation: http://docs.haplo.org/dev/standard-plugin/document-store
P.ExampleUsageWorkflow.use("std:document_store", {
    name:"form",
    title: "Workflow form",
    path: "/do/example-usage/document-store",
    panel: 200,
    showFormTitlesWhenEditing: true,
    formsForKey: function(key, instance, document) {
        var forms = [form0];
        if(document.secondForm) {
            forms.push(form1);
        }
        return forms;
    },
    alwaysShowNavigation: function(key, instance, document) {
        return true;
    },
    view: [{}],
    edit: [{roles:["user"], selector:{state:"wait_submit"}}],
    viewDraft: [{roles:["user"]}],
    addComment: [{}],
    viewComments: [{}],
    viewCommentsOtherUsers: [{selector:{closed:true}}]
});
