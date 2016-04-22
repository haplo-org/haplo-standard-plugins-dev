// Action panel documentation: http://docs.haplo.org/dev/standard-plugin/action-panel
P.implementService("std:action_panel:example_file", function(display, builder) {
    var M = O.service("std:workflow:for_ref", "example_usage:egu", display.object.ref);
    if(M) { return; } // already started
    if(O.currentUser.ref == display.object.first(A.Author)) {
        builder.panel(100).link(100,
            "/do/example-usage/start/"+display.object.ref.toString(),
            "Workflow",
            "primary");
    }
});

// Request handling documentation: http://docs.haplo.org/dev/plugin/request-handling
P.respond("GET,POST", "/do/example-usage/start", [
    {pathElement:0, as:"object"}
], function(E, object) {
    if(E.request.method === "POST") {
        var M = P.ExampleUsageWorkflow.create({object:object});
        E.response.redirect("/do/example-usage/document-store/form/"+M.workUnit.id);
    }
    E.render({
        pageTitle: "Start workflow",
        backLink: object.url(),
        text: "Start workflow",
        options: [{label:"Start"}]
    }, "std:ui:confirm");
});
