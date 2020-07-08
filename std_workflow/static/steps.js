/* Haplo Platform                                    https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

 (function($) {

     $(document).ready(function() {

         // Prevent users losing data when navigating between steps by checking to
         // see if any form contents have been changed.

         var getAllFormData = function() {
             var serialised = [];
             $('form').each(function() {
                 serialised.push($(this).serialize());
             });
             return serialised.join("\t");
         };

         var navigation = $('#z__workflow_steps_container');
         if(navigation.length) {
             var formsAtStart = getAllFormData();
             navigation.on('click', 'button', function(evt) {
                 if(formsAtStart !== getAllFormData()) {
                     if(!window.confirm(navigation[0].getAttribute('data-navawaymsg'))) {
                         evt.preventDefault();
                     }
                 }
             });
         }

     });

 })(jQuery);
