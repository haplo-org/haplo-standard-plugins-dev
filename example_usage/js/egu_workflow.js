// Workflow documentation: http://docs.haplo.org/dev/standard-plugin/workflow
var ExampleUsageWorkflow = P.ExampleUsageWorkflow = P.workflow.implement("egu", "Custom workflow").
    objectElementActionPanelName("example_file");

// Entities documentation: http://docs.haplo.org/dev/standard-plugin/workflow/definition/std-features/entities
ExampleUsageWorkflow.use("std:entities", {
    user: ["object", A.Author]
});
ExampleUsageWorkflow.use("std:entities:roles");
ExampleUsageWorkflow.use("std:entities:entity_shared_roles", {
    entities: ["user"]
});

ExampleUsageWorkflow.start(function(M, initial, properties) {
    initial.state = "wait_submit";
});

ExampleUsageWorkflow.states({
    "wait_submit": {
        actionableBy: "user",
        transitions: [
            ["submit", "finished"]
        ]
    },
    "finished": {
        finish: true
    }
});

ExampleUsageWorkflow.notifications({
    finished: {
        to: ["user"],
        view: function(M) {
            return {
                value: M.entities.user_maybe ? M.entities.user.title : "No user"
            };
        }
    }
});
