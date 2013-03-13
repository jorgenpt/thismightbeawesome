// ==UserScript==
// @name           This Might Be Awesome
// @description    TMBO script to enhance the browsing experience
// @namespace      http://userscripts.org/users/jorgenpt
// @include        http*://thismight.be/offensive/*
// @copyright      2010, Jørgen P. Tjernø (http://userscripts.org/users/jorgenpt)
// @license        GPL version 3 or any later version; http://www.gnu.org/copyleft/gpl.html
// @version        0.2.0
// ==/UserScript==

/*** Changelog ***
 2013-03-12
    * Make it work as a Chrome Extension.
    * Rename it to "This Might Be Awesome."
    * Integrate work from oliphaunt to show sums on votedetail page for a user.

 2010-05-17
    * Sort both votes and voters. (Based on a suggestion from "pixel4e")

 2010-01-02
    * Summarize votes from comments too, but keep the vote
      with the comment. (Based on a suggestion from "Richey")
    * Make use of newly added commentList id and userLink class.
      (remove ugly document.title hack)
    * Add a menu command (Tools -> Greasemonkey -> User Script Commands)
      that shows version and links you to the userscripts.org page.

 2009-12-20
    * Improved method of recalculating position after modifying DOM.
      (This one doesn't mess with browser history.)

 2009-12-19
    * Change @include to use /everything/, and check for [discuss] at start
      of title. Not the cleanest solution, but it works after POSTing a
      vote.
    * Add a count (number of people) for each vote.
    * Fixed a bug when a person voted two different things
      (needed to clone a DOM node).
    * When going to urls with anchors, rejump to anchor when DOM-modding
      is done.
 *** Changelog ***/

// Find the right script to run.
var query = window.location.search;
if (query.indexOf("c=votedetail") >= 0) {
    sumVotes();
} else if (query.indexOf("c=comments") >= 0) {
    summarizeVotes();
}

// addition by oliphaunt: sum votes.
function sumVotes() {
    // do we understand this page?
    var rightCol = document.getElementById("rightcol");
    if ( !rightCol ) return;

    var tableList = rightCol.getElementsByTagName("table");
    if ( !tableList || tableList.length != 1 ) return;

    // apparently so.  iterate over the votes.
    table = tableList[0];
    var pos = 0;
    var neg = 0;
    for ( var i = 0; i < table.rows.length; ++i ) {
	var row = table.rows[i];
	if ( row.cells.length != 3 ) {
	    // don't know how to deal with this row. skip it.
	    continue;
	}
	pos += parseInt(row.cells[1].textContent);
	neg -= parseInt(row.cells[2].textContent);
    }

    // calculate a percentage (if possible)
    var total = Math.abs(pos) + Math.abs(neg);
    if ( total <= 0 ) return;
    var posperc = Math.round(100*pos/total);
    var text = 'positive: ' + pos + ' (' + posperc + '%)' + ' | negative: ' + neg + ' (' + (100-posperc) + '%)';

    // and display the summary above the votes table
    var b = document.createElement('b');
    b.appendChild(document.createTextNode(text));
    var div = document.createElement('div');
    div.appendChild(b);
    div.style.textAlign = 'center';
    table.parentNode.insertBefore(div,table);
}

function summarizeVotes() {
    var commentList = document.getElementById("commentList");
    if (!commentList)
        return;

    String.prototype.trim = function() { return this.replace(/^\s+|\s+$/, ''); };

    // Set scrolling to the element with the given name.
    function jumpToName(name)
    {
        var anchors = document.getElementsByName(name);
        if (!anchors.length)
            return;

        var element = anchors[0];
        var offset = 0;
        while (element)
        {
            offset += element.offsetTop;
            element = element.offsetParent;
        }

        window.scroll(window.scrollX, offset);
    }

    var summaries = {};
    // Increment the counts for the votes that this user posted.
    function updateSummaries(entry)
    {
        var links = entry.getElementsByClassName('userLink');
        if (links.length < 1)
        {
            GM_log("Couldn't find userLink for post, skipping.");
            return;
        }

        var user = links[0];
        var votes = entry.getElementsByClassName('vote');
        for (var i = 0; i < votes.length; i++)
        {
            var vote = votes[i].textContent.trim();
            if (!summaries[vote])
                summaries[vote] = [];
            summaries[vote].push(user);
        }
    }

    function sortSummaries()
    {
        function byUsername(a, b)
        {
            var anew = a.textContent.toLowerCase();
            var bnew = b.textContent.toLowerCase();
            if (anew < bnew) return -1;
            if (anew > bnew) return 1;
            return 0;
        }

        var sortable = [];
        for (var summary in summaries)
        {
            var voters = summaries[summary];
            voters.sort(byUsername);
            sortable.push([summary, voters]);
        }

        sortable.sort();
        summaries = {};
        for (var i = 0; i < sortable.length; ++i)
            summaries[sortable[i][0]] = sortable[i][1];
    }

    // Calculate the length of a users post - just the content.
    function postLength(entry)
    {
        var text = '';
        for (var i = 0; i < entry.childNodes.length; ++i)
        {
            var child = entry.childNodes[i];
            var type = child.nodeName;

            // We count everything until the timestamp <div> (which is the first non-post-content element).
            if (type != 'DIV' || child.className.indexOf('timestamp') == -1)
                text += child.textContent.trim();
            else
                break;
        }

        return text.length;
    }

    var colors = ['#CCF', '#BBE'];
    var color = 0;

    // Go over all the posts, remove empty ones and add them to the summary.
    var entries = commentList.getElementsByClassName("entry");
    for (var i = 0; i < entries.length; ++i)
    {
        entry = entries[i];

        // Non-empty posts are left alone (but recolored, to keep colors).
        if (postLength(entry))
        {
            entry.style.backgroundColor = colors[color];
            color = (color + 1) % colors.length;
        }
        else // Empty posts are hidden.
            entry.style.display = 'none';

        // Update summaries based on this post.
        updateSummaries(entry);
    }

    // Sort votes and voters.
    sortSummaries();

    // Create an <ul> of the different votes and their voters.
    var ul = document.createElement('ul');
    for (var summary in summaries)
    {
        var voters = summaries[summary];
        var li = document.createElement('li');

        li.textContent = summary + ' ';
        for (var i = 0; i < voters.length; i++)
        {
            li.appendChild(voters[i].cloneNode(true));
            li.appendChild(document.createTextNode(', '));
        }

        // Remove last separator.
        li.removeChild(li.childNodes[li.childNodes.length - 1]);

        // Add a count of votes
        if (voters.length > 3)
            li.appendChild(document.createTextNode(' (' + voters.length + ' people)'));

        ul.appendChild(li);
    }

    // Add it to the top of the comment list.
    commentList.insertBefore(ul, entries[0].previousElementSibling);

    // This makes it recalc the position after modifying DOM.
    var hash = window.location.hash;
    if (hash.indexOf('#') == 0)
        hash = hash.substring(1);

    if (hash.length)
        jumpToName(hash);
}
