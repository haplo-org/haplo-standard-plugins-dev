(function($) {
    $(document).ready(function() {
        var createDisplayForValue = function(value, title) {
            var html = [
                '<div class="z__std_reporting_multiselect_display_item" id="'+value+'">',
                    '<a href="#" class="z__std_reporting_multiselect_remove_item" role="button">X</a>&nbsp;',
                    title,
                '</div>'
            ].join('');
            return $(html);
        };


        var getSelectedOption = function(select) {
            return $(select).find('option:selected');
        };

        var appendRemoveHandler = function(element) {
            $(element).
                children(".z__std_reporting_multiselect_remove_item").
                on('click', function(e) {
                    e.preventDefault();
                    var parent = $(this).parent();
                    var value = parent.attr('id');
                    var target = parent.
                        parent().
                        siblings(".z__std_reporting_multiselect_target").
                        first();
                    var source = target.
                        siblings('.z__std_reporting_multiselect_source').
                        first();

                    target.
                        children('option[value='+value+']').
                        prop("selected", false).
                        appendTo($(source));

                    $(source).
                        children('option').
                        sort(function(a, b) {
                            var aInt = parseInt(a.getAttribute('data-sort-index'), 10);
                            var bInt = parseInt(b.getAttribute('data-sort-index'), 10);
                            return aInt - bInt;
                        }).
                        appendTo($(source));

                    target.change();
                    source.change();
                    parent.remove();
                });
        };

        $('.z__std_reporting_multiselect_source').each(function() {
            $(this).children('option').each(function(index) {
                $(this).attr('data-sort-index', index.toString());
            });
        });

        $(".z__std_reporting_multiselect_source").on('change', function(e) {
            e.preventDefault();
            if($(this).val()) {
                var target = $(this).siblings(".z__std_reporting_multiselect_target").first();

                // Create display value
                var displayValue = createDisplayForValue($(this).val(), getSelectedOption(this).text());
                appendRemoveHandler(displayValue);

                // Move actual value
                getSelectedOption(this).
                    prop("selected", true).
                    appendTo(target);
                target.change();

                // Update UI with new display
                var display = $(this).siblings(".z__std_reporting_multiselect_display").first();
                displayValue.appendTo(display);

                $(this).val('');
            }
        });
    });
})(jQuery);