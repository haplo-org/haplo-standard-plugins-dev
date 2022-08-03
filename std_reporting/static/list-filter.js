/* Haplo Platform                                     http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

(function($) {

    var normaliseName = function(text) {
        return text.trim().toLowerCase();
    };

    $(document).ready(function() {

        var lastSelector = '';
        var updateForFilters = function() {
            var selector = '';
            var $selector = $('#z__std_reporting_list_filterable_table tbody tr');

            // Filter on text searches
            var textFilter = normaliseName($('#z__std_reporting_list_text_filter').val() || '').toLowerCase();
            var textFilterTerms = textFilter.split(" ");
            textFilterTerms.forEach(function(term) {
                if(term !== "") {
                    var selectorString = '[data-text-filter*="'+term+'"]';
                    selector += selectorString;
                    $selector = $selector.filter(selectorString);
                }
            });
            // Filter on dropdowns
            $('.z__std_reporting_list_object_filter').each(function() {
                if(this.value) {
                    var selectorString = '[data-'+this.getAttribute('data-fact')+'='+this.value+']';
                    selector += selectorString;
                    $selector = $selector.filter(selectorString);
                }
            });

            $('.z__std_reporting_list_multiple_object_filter_container').each(function() {
                var fact = this.getAttribute('data-fact');
                var multipleSelectValues = $(this).children('.z__std_reporting_list_multiple_object_filter_select').first().val();
                if(multipleSelectValues) {
                    var comparison = $(this).find('input[name=filterOperator-'+fact+']:checked').first().val();
                    var valueSelectors = _.map(multipleSelectValues, function(valueToSelect) {
                        return '[data-'+fact+'*='+valueToSelect+']';
                    });
                    var selectorString = valueSelectors.join((comparison === "INCLUDES") ? "," : "");
                    selector += selectorString;
                    $selector = $selector.filter(selectorString);
                }
            });

            if(lastSelector === selector) { return; }
            if(selector) {
                $('#z__std_reporting_list_filterable_table tbody tr').hide();
                $selector.show();
                $('.z__std_reporting_export_form > :submit').val("Export (filtered)");
            } else {
                $('#z__std_reporting_list_filterable_table tbody tr').show();
                $('.z__std_reporting_export_form > :submit').val("Export");
            }
            lastSelector = selector;
        };

        // Update when user types into search field
        $('#z__std_reporting_list_text_filter').on('keyup change search mouseup', 
            _.debounce(updateForFilters, 150));

        // Update when user selects from an object list
        $('.z__std_reporting_list_object_filter').on('change', function() {
            var changedDropDown = this;
            // Find dropdowns to the right of this one
            var dropDownsOnRight = [];
            var seenThisDropDown = false;
            $('.z__std_reporting_list_object_filter').each(function() {
                if(seenThisDropDown) {
                    dropDownsOnRight.push(this);
                } else if(changedDropDown === this) {
                    seenThisDropDown = true;
                }
            });
            // Unselect any dropdowns to the right of the changed dropdown
            _.each(dropDownsOnRight, function(d) {
                d.value = '';
            });
            // Filter according to any selected items and/or updates made above
            updateForFilters();
            // Disable entries in dropdowns to the right of this which aren't visible
            var rows;
            _.each(dropDownsOnRight, function(d) {
                if(!rows) { rows = $('#z__std_reporting_list_filterable_table tr:visible'); }
                var used = {'':true}; // blank placeholder is always 'used' and should be selectable
                var attribute = 'data-'+d.getAttribute('data-fact');
                rows.each(function() { used[this.getAttribute(attribute)] = true; });
                $('option', d).each(function() {
                    this.disabled = used[this.value] ? '' : 'disabled';
                });
            });
        });
        $('.z__std_reporting_list_multiple_object_filter_select,.z__std_reporting_list_multiple_object_filter_operator input[type="radio"]').on('change', function() {
            updateForFilters();
        });

        // Handle special case of select parameters overwriting each other during serialisation
        // Adds hidden text element to the form a final parameter with all the values serialised ready for manipulation server-side
        $('.z__std_reporting_export_form').parent('form').on('submit', function(e) {
            var formSelector = $(this);
            formSelector.find('.z__std_reporting_export_serialised_multiple_select').remove();
            formSelector.find('.z__std_reporting_list_multiple_object_filter_select').each(function() {
                var values = $(this).val();
                if(values && values.length > 1) {
                    $('<input type="text" name="'+this.getAttribute("name")+'-serialised" value="'+values.join(",")+'">').
                        addClass("z__std_reporting_export_serialised_multiple_select").
                        hide().
                        appendTo(formSelector);
                }
            });
        });
    });
})(jQuery);
