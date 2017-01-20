(function($) {

    var loremipsum = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi nec libero maximus, mollis mi ut, cursus sem. Mauris enim mi, tempor eu fringilla vitae, porttitor vitae neque. Integer sed tortor consectetur, tincidunt neque et, lobortis risus. Integer ultrices pretium nisi, id finibus elit pharetra at. Nulla elementum mi sed metus suscipit, vel ornare velit porta. Sed et lorem vitae neque gravida interdum vitae nec dolor. Cras metus tortor, posuere nec diam et, vestibulum vehicula ligula. Vivamus tortor ex, pulvinar et nisl vel, tristique molestie neque. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Etiam turpis nisi, ultrices id odio at, tristique tempus metus. Praesent non maximus dolor.".split(". ");

    var getSomeText = function() {
        var start = Math.floor(Math.random() * loremipsum.length);
        var end = Math.floor(Math.random() * (loremipsum.length - start+1)) + (start+1);
        return _.shuffle(loremipsum).slice(start, end).join(". ");
    };

    var getOnlyOneText = function() {
        return loremipsum[Math.floor(Math.random() * loremipsum.length)];
    };

    var quickfill = function() {
        $(".oforms-row textarea").each(function() { this.value = getSomeText(); });
        $(".oforms-row input[type=text]:not([class])").each(function() { this.value = getOnlyOneText(); });
        $("input[type=text][class=oforms-number]").each(function() { this.value = Math.floor(Math.random()*999); });
        // TODO: smartly randomise dates that are shortly in the future
        var d = new Date();
        d.setMonth((d.getMonth()+1) % 11);
        var month = d.getMonth()+1; // 0 indexed
        d.setFullYear(d.getFullYear() + (month < d.getMonth() ? 1 : 0));
        var year = d.getFullYear();
        $(".oforms-date input[type=hidden]").each(function() { 
            this.value = year+"-"+("0"+month).slice(-2)+"-28";
        });
        // toLocaleString might not work in all browsers
        $(".oforms-date input[type=text]").each(function() { this.value = "28 "+d.toLocaleString("en-us", {month:"short"})+" "+year; });
        $(".oforms-boolean").each(function() { 
            var yesno = $(this).find("input[type=radio]"); 
            yesno[Math.floor(Math.random()*2)].checked = true; 
        });
        $(".oforms-radio-vertical").each(function() {
            var options = $(this).find("input[type=radio]");
            options[Math.floor(Math.random()*options.length)].checked = true;
        });
        $("input[type=checkbox]").prop("checked", true);
    };

    $(document).ready(function() {
        $(".z__quickfill_action").on("click", function(e) {
            e.preventDefault();
            quickfill();
        });
    });
})(jQuery);
