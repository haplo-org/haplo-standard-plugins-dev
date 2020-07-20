t.test(function() {

    // --------------------------------------------------------------------------
    // Setup
    // --------------------------------------------------------------------------
    let serialiser1 = O.service("std:serialisation:serialiser");
    let serialiser2 = O.service("std:serialisation:serialiser");
    let serialiser3 = O.service("std:serialisation:serialiser");

    let testSource;

    let testObject = O.object();
    testObject.appendType(TYPE["std:type:book"]);
    let testFile = O.file(O.binaryData("test"));
    console.log("testFile:", testFile);
    console.log("testFile.fileSize:", testFile.fileSize);
    console.log("testFile.filename:", testFile.filename);
    testObject.append(testFile, ATTR["std:attribute:file"]); //TODO: why doesn't this work?
    testObject.appendTitle("Example");
    testObject.save();

    let testWorkUnit = O.work.create({
        workType: "std_serialisation:test",
        ref: testObject.ref
    });
    testWorkUnit.save();

    // TODO: add some schema to add attribetus of the following types

    // --------------------------------------------------------------------------
    // Testing
    // --------------------------------------------------------------------------
    try {
        // Configuring from parameters ------------------------------------------
        t.assertThrows(() => {
            serialiser1.configureFromParameters({"transform": "unknown"});
        }, "Unknown transform specified: unknown");

        serialiser1.configureFromParameters({"transform": "restrict"});
        t.assert(serialiser1.$restrictObject);

        serialiser1.configureFromParameters({"sources": "NONE"});
        let serialisation1 = serialiser1.encode(testObject);

        t.assertEqual(serialisation1.kind, "haplo:object:0");
        t.assertEqual(serialisation1.sources.length, 0);
        t.assert(-1 !== serialisation1.transform.indexOf("restrict"));
        t.assertEqual(serialisation1.recordVersion, 1);
        t.assertEqual(serialisation1.title, "Example");
        t.assertEqual(serialisation1.deleted, false);
        t.assertEqual(serialisation1.type.code, "std:type:book");
        t.assertEqual(serialisation1.type.name, "Book");
        let attributes = serialisation1.attributes;
        let type = attributes["dc:attribute:type"][0];
        t.assertEqual(type.type, "link");
        t.assertEqual(type.code, "std:type:book");
        t.assertEqual(type.title, "Book");
        let title = attributes["dc:attribute:title"][0];
        t.assertEqual(title.type, "text");
        t.assertEqual(title.value, "Example");
        t.assertEqual(serialisation1.workflows, undefined);
        let file = attributes["std:attribute:file"][0];
        t.assertEqual(file.type, "file");
        t.assertEqual(file.digest, testFile.digest);
        t.assertEqual(file.fileSize, testFile.fileSize);
        t.assertEqual(file.mimeType, "application/octet-stream");
        t.assertEqual(file.filename, "data.bin");

        t.assertThrows(() => {
            serialiser1.restrictObject();
        }, "Cannot change options after serialiser has been used.");

        // Configuring with built in functions ----------------------------------
        serialiser2.useAllSources();
        t.assert(serialiser2.$useAllSources);

        let serialisation2 = serialiser2.encode(testObject);
        t.assertEqual(serialisation2.transform, undefined);
        t.assert(serialisation2.sources.length > 0);
        t.assert(-1 !== serialisation2.sources.indexOf("std:workunit"));
        t.assertEqual(serialisation2.workflows.length, 1);
        t.assertEqual(serialisation2.workflows[0].workType, "std_serialisation:test");
        t.assertEqual(serialisation2.workflows[0].closed, false);

        testWorkUnit.close(O.user(3));
        testWorkUnit.save();
        let serialisation3 = serialiser2.encode(testObject);
        t.assert(serialisation3.workflows[0].closed);
    }

    // --------------------------------------------------------------------------
    // Teardown
    // --------------------------------------------------------------------------
    finally {
        testWorkUnit.deleteObject();
        testObject.deleteObject();
    }
});