// Forms documentation: http://docs.haplo.org/dev/plugin/form
var form0 = P.form({
    specificationVersion:0,
    formId: "exForm0",
    formTitle: "Overview",
    elements: [
        {
            type:"paragraph",
            path:"description",
            label:"Description",
            required:true
        }
    ]
});

var form1 = P.form({
    specificationVersion:0,
    formId: "exForm1",
    formTitle: "Details",
    elements: [
        {
            type:"paragraph",
            path:"furtherInfo",
            label:"Further info",
            required:true
        }
    ]
});

// Document store documentation: http://docs.haplo.org/dev/standard-plugin/document-store
P.ExampleUsageWorkflow.use("std:document_store", {
    name:"form",
    title: "Workflow form",
    path: "/do/example-usage/document-store",
    panel: 200,
    formsForKey: function(key) {
        return [form0, form1]; 
    },
    view: [{}],
    edit: [{roles:["user"], selector:{state:"wait_submit"}}]
});
