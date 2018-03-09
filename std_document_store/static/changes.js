
(function($) {

    $(document).ready(function() {

        // Configuration
        var configDiv = $('#z__docstore_changes_configuration')[0],
            filterOn = configDiv.getAttribute('data-filter') === "1";

        $('#z__docstore_body .z__docstore_form_display').each(function() {
            var previousElement = document.getElementById("_prev_"+this.id);
            if(previousElement) {
                oFormsChanges.display($('.oform',this)[0], $('.oform',previousElement)[0], false);
            }
        });

        $('#z__docstore_body .z__docstore_form_display').each(function() {
            oFormsChanges.unchangedVisibility(this, !filterOn);
        });

        if(filterOn) {
            var link = $('#z__docstore_choose_version').value;
            if(filterOn && link && link.charAt(0) === '?') {
                window.location.href = link;
            }
        }

        $('#z__docstore_choose_version').on("change", function() {
            var link = this.value;
            if(link && link.charAt(0) === '?') {
                window.location = link;
            }
        });
    });
    
})(jQuery);
