(function($) {
    $(document).ready(function() {
        var createDisplayForValue = function(value, title) {
            var html = [
                '<div class="z__std_reporting_multiselect_display_item" id="'+value+'" data-title="'+title+'">',
                    title,
                    '&nbsp;<a href="#" class="z__std_reporting_multiselect_remove_item" role="button">X</a>',
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
                        siblings('.z__std_reporting_multiselect_list').
                        first();

                    target.
                        children('option[value='+value+']').
                        prop("selected", false).
                        attr('data-value', value).
                        val($(parent).attr('data-title')).
                        text('').
                        appendTo($(source));

                    $(source).
                        children('option').
                        sort(function(a, b) {
                            var aInt = parseInt(a.getAttribute('data-sort-index'), 10);
                            var bInt = parseInt(b.getAttribute('data-sort-index'), 10);
                            return aInt - bInt;
                        }).
                        appendTo($(source));
                    if(!target.val()) {
                        parent.siblings('.z__std_reporting_list_multiple_object_filter_operator').removeClass('active');
                        parent.parent().parent().removeClass('active');
                    }

                    target.change();
                    source.change();
                    parent.remove();
                });
        };

        $('.z__std_reporting_multiselect_list').each(function() {
            $(this).children('option').each(function(index) {
                $(this).attr('data-sort-index', index.toString());
            });
        });

        $(".z__std_reporting_multiselect_source").on('input', function(e) {
            e.preventDefault();
            var list = $(this).siblings(".z__std_reporting_multiselect_list").first();
            var matchingItem = list.find('option[value="'+$(this).val()+'"]').first();
            if(matchingItem && matchingItem.length) {
                var target = $(this).siblings(".z__std_reporting_multiselect_target").first();
                var title= $(matchingItem).val();
                var value = matchingItem.data('value');
                // Create display value
                var displayValue = createDisplayForValue(value, title);
                appendRemoveHandler(displayValue);

                // Move actual value
                $(matchingItem).
                    text(title).
                    val(value).
                    prop("selected", true).
                    appendTo(target);
                target.change();

                // Update UI with new display
                var display = $(this).siblings(".z__std_reporting_multiselect_display").first();
                display.find('.z__std_reporting_list_multiple_object_filter_operator').addClass('active');
                displayValue.appendTo(display);

                $(this).parent().addClass('active');
                $(this).val('');
            }
        });
    });
})(jQuery);