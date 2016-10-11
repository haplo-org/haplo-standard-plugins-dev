/* Haplo Platform                                     http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

// Render blocks in templates depending on whether the user matches a certain entity/role
//      std:workflow:entities:user(M user) {} entity { "block to render" }
// - renders the anonymous block on no match
P.globalTemplateFunction("std:workflow:entities:user", function(M, user) {
    var matches = []; 
    if("ref" in user) {
        _.each(M.entities.$entityDefinitions, function(defn, entity) { 
            if(_.any(M.entities[entity+"_refList"], function(ref) { return ref == user.ref; })) {
                matches.push(entity);
            }
        });
    } 
    if(matches.length) { _.each(matches, function(m) { this.writeBlock(m); }); }
    else { this.writeBlock(null); }
});

