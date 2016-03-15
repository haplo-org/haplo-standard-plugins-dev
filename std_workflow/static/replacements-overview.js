/* Haplo Platform                                     http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    var setSelected = function(checkBox) {
        var setLink = checkBox.parents('tr').find('.z__replace');
        if(checkBox.is(':checked')) {
            setLink.show();
        } else {
            setLink.hide();
        }
    };

    $(document).ready(function() {

        $('#z__applySelection').hide();
        $('.z__selected').each(function() {
            setSelected($(this));
        });

        $('.z__selected').on('change', function() {
            $('#z__applySelection').show();
            setSelected($(this));
        });

    });

})(jQuery);
