
(function($) {

    $(document).ready(function() {
        $('#z__docstore_body .z__docstore_form_display').each(function() {
            var previousElement = document.getElementById("_prev_"+this.id);
            if(previousElement) {
                oFormsChanges.display($('.oform',this)[0], $('.oform',previousElement)[0], false);
            }
        });
    });
    
})(jQuery);
