t.test(function() {
    console.log('Ahoy there');
    
    // Set up
    var personType = TYPE["std:type:person"];

    var o1 = O.object();
    o1.appendType(personType);
    o1.appendTitle("Mavis Enderby");
    o1.save();

    var o2 = O.object();
    o2.appendType(personType);
    o2.appendTitle("Arthur Scargill");
    o2.save();

    // FIXME: Find a type with two attributes I can point at people
    // and set them to o1 and o2
    var o3 = O.object();
    o3.appendType(TYPE["std:type:project"]);
    o3.appendTitle("A murder");
    o3.save();

    var implement = implementWorkflow(P);
    var PermTestWorkflow = implement("permissions_test", "Permissions test workflow");
    PermTestWorkflow.objectElementActionPanelName("permissions_test");
    PermTestWorkflow.use("std:entities", {
        // FIXME: Set it up so that o1 is victim, o2 is victor initially
        "originalVictim": ["object"],
        "originalVictor": ["object"]
    });
    PermTestWorkflow.use("std:entities:entity_replacement", {
        "victim": {
            entity: "originalVictim",
            assignableWhen: {state: "anger"},
            replacementTypes: [personType]
        },
        "victor": {
            entity: "originalVictor",
            assignableWhen: {state: "anger"},
            replacementTypes: [personType]
        }
    });
    PermTestWorkflow.use("std:entities:roles");
    PermTestWorkflow.states({
        denial: {
            actionableBy: "victim",
            transitions: [
                ["proceed", "guilt"]
            ]
        },
        guilt: {
            actionableBy: "victor",
            transitions: [
                ["proceed", "anger"],
                ["regress", "denial"]
            ]
        },
        anger: {
            actionableBy: "victim",
            transitions: [
                ["proceed", "depression"],
                ["regress", "guilt"]
            ]
        },
        depression: {
            actionableBy: "victor",
            transitions: [
                ["proceed", "upward_turn"],
                ["regress", "anger"]
            ]
        },
        upward_turn: {
            actionableBy: "victim",
            transitions: [
                ["proceed", "reconstruction"],
                ["regress", "depression"]
            ]
        },
        reconstruction: {
            actionableBy: "victor",
            transitions: [
                ["proceed", "aceptance"],
                ["regress", "upward_turn"]
            ]
        },
        acceptance: {
            finish: true
        }
    });
    PermTestWorkflow.start(function(M, initial, properties) {
        initial.state = "denial";
    });

    PermTestWorkflow.use("std:permissions", [
        {entity: "victor", hasPermission: "read"},
        {inState: "anger", actionableByHasPermission: "read-write"}
    ]);

    // Test helpers

    var testPermissions = function(readers, writers) {
        var actualReaders = O.service("std:workflow:get_additional_readers_for_object", o3);
        var actualWriters = O.service("std:workflow:get_additional_writers_for_object", o3);
        var objCompare = function(a, b) {
            return a.ref-b.ref;
        };
        var compareObjectArrays = function(a, b) {
            t.assert(a.length == b.length);
            for(var i=0;i<a.length;i++) {
                t.assert(a[i].ref == b[i].ref);
            }
        };
        actualReaders.sort(objCompare);
        actualWriters.sort(objCompare);
        readers.sort(objCompare);
        writers.sort(objCompare);
        compareObjectArrays(actualReaders, readers);
        compareObjectArrays(actualWriters, writers);
    };

    // Test!

    var M = PermTestWorkflow.create({object: o3});

    // denial; o2, the victor, has read via the entity rule; o1, the victim, has read-write via the actionableBy rule
    testPermissions([o2,o1],[o1]);

    M.transition("proceed");
    // guilt; o2, the victor, has read via the entity rule and read-write via the actionableBy rule; o1, the victim, has nothing
    testPermissions([o2],[o2]);

    M.transition("proceed");
    // anger; o2, the victor, has read via the entity rule; o1, the victim, has read-write via the actionableBy rule
    testPermissions([o2,o1],[o1]);

    // Swap entity roles
    t.post("/do/workflow/replace", {
        "workUnit": M.workUnit,
        "path": "victim",
        "object": o2.ref
    });
    t.post("/do/workflow/replace", {
        "workUnit": M.workUnit,
        "path": "victor",
        "object": o1.ref
    });

    // anger; o1, the victor, has read via the entity rule; o2, the victim, has read-write via the actionableBy rule
    testPermissions([o1,o2],[o2]);

    // Spare transitions to hang further tests off of, if needed
    M.transition("proceed");
    M.transition("proceed");
    M.transition("proceed");
    M.transition("proceed");

    // Tidy up

    o1.deleteObject();
    o2.deleteObject();
    o3.deleteObject();
});
