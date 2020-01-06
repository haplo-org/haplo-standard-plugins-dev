
P.hook("hObjectDisplay", function(response, object) {
    if(O.currentUser.isSuperUser) {
        response.buttons["*SERIALISATIONOBJECTJSON"] = [["/do/std-serialisation-dev/object-json/"+object.ref, "JSON"]];
    }
});

P.respond("GET", "/do/std-serialisation-dev/object-json", [
    {pathElement:0, as:"object"}
], function(E, object) {
    if(!O.currentUser.isSuperUser) { O.stop("Not permitted"); }
    E.response.body = JSON.stringify(O.service("std:serialisation:encode", object), undefined, 2);
    E.response.kind = "json";
});
