/**
 * The model section of the bookmark bar switcher extension. This is where
 * we do the real work. We are mainly dealing with data storage and shuffling
 * bookmarks back and forth.
 *
 * @author Zoee Silcock
 **/

/**
 * The name of the currently selected bookmark bar.
 **/
var currentBB;

/**
 * The IDs to important bookmark folders.
 **/
var otherBookmarksId;  // Shouldn't be needed, come on Google.
var bookmarkBarId;     // Shouldn't be needed, come on Google.
var bookmarkBarsId;    // The root of our bookmark storage folder.

var loggingEnabled = true;

/**
 * This starts of the initialization process for the extension. It calls
 * initMetaData() which in it's turn calls initData(). Together these make
 * sure the extension has everything it needs to function.
 **/
$(function() {
	initMetaData();	
});

/**
 * Here we prepare the bookmark folders we need to do our job. It will first
 * find the id of the Other Bookmarks folder and save it (seriously google,
 * fix this). Next it will look for the BookmarksBars folder which contains
 * our meta data and the actual bookmark bars. If it doesn't find one it will
 * create one. Finally it calls initData() which will enter default values
 * if none are found. The reason we call it from here is because this
 * function must have finished before initData() can be run since it uses
 * the bookmarkBarsId.
 **/
function initMetaData() {
	chrome.bookmarks.getTree(function(bookmarks) {
		$.each(bookmarks[0].children, function(i, item) {
			if(item.title == "Other Bookmarks") {
				// Save the bookmark root object for future reference.
				otherBookmarksId = item.id;

				$.each(item.children, function(index, subitem) {
				 	if(subitem.title == "BookmarkBars") {
						// Found the BookmarkBars folder, save the id.
						bookmarkBarsId = subitem.id;
					}
				});
			} else if(item.title == "Bookmarks Bar") {
				// Save the Bookmark Bar object, not to be confused with BookmarkBars.
				bookmarkBarId = item.id;
			}
		});

		if(bookmarkBarsId == null) {
			// No BookmarkBars folder was found, create it.
			chrome.bookmarks.create({parentId: otherBookmarksId,
				title: "BookmarkBars"}, function(result) {
					bookmarkBarsId = result.id;
					initData();
			});
		} else {
			initData();
		}
	});
}

/**
 * This function initializes both of our storages. Firstly we will check
 * the localStorage to see if we have an array of bookmark bar names saved
 * and if not we will add an array that only contains the default bar.
 * Secondly we will check the bookmark based meta data which we need to
 * support bookmark synchers. Same thing there, save the default name if
 * the meta data is empty.
 **/
function initData() {
	var bars = getBars();

	if(bars == null || bars.length == 0) {
		// No bookmark bars found in the localStorage, lets create the default bar.
		newBar("Default");
	}
	
	loadMetaData();
}

/**
 * A simple getter so the view can know which bookmark bar to highlight.
 **/
function getCurrentBB() {
	return currentBB;
}

/**
 * This method allows the user to switch between different bookmark bars.
 * What it does is rather simple but due to the way the chrome bookmark api
 * works it looks more complicated than it is. All we are doing is moving all
 * the items from the Bookmark Bar folder into it's storage folder and then
 * moving all bookmarks out of the new bars storage folder into the Bookmark
 * Bar folder. We also update the meta data to reflect this change. 
 * 
 * Note that due to the asynchronous nature of the chrome api we will in fact
 * update the meta data before the rest of the function is done.
 **/
function selectBar(bar) {
	// Store the name of the current bar since setMetaData will change it
	// before we need it when moving out the old bookmarks.
	var current = currentBB;

	chrome.bookmarks.getChildren(bookmarkBarsId, function(folders) {
		// Go through the bookmark storage folders.
		$.each(folders, function(index, folder) {
			if(folder.title == current) {
				// We have found the storage folder for the current bar.
				// Move every bookmark in the bar to it's storage folder.
				chrome.bookmarks.getChildren(bookmarkBarId, function(items) {
					$.each(items, function(i, item) {
						chrome.bookmarks.move(item.id, {parentId: folder.id});
					});
				});
			}
		});

		// Go through the bookmark storage folders.
		$.each(folders, function(index, folder) {
			if(folder.title == bar) {
				// We have found the storage folder for the selected bar.
				// Move every bookmark in the storage folder to the bookmark bar.
				chrome.bookmarks.getChildren(folder.id, function(items) {
					$.each(items, function(i, item) {
						chrome.bookmarks.move(item.id, {parentId: bookmarkBarId});
					});
				});
			}
		});
	});

	// Update the meta data so we are compatible with bookmark synchers.
	setMetaData(bar);
}

/**
 * Creates a new bookmark bar by the name specified. It will check that the
 * name isn't already taken and if not add it to the localStorage and
 * create a storage folder for it.
 **/
function newBar(name) {
	var bars = getBars();
	var result;

	if(jQuery.inArray(name, bars) == -1) {
		bars.push(name);
		saveBars(bars);

		chrome.bookmarks.create({parentId: bookmarkBarsId, title: name});
	} else {
		result = "This name is taken.";
	}

	return result;
}

/**
 * Load the array which contains a list of bookmark bar names from the
 * html 5 localStorage. The array is stored as a serialized string with
 * semicolon separators. If no array is found we just return an empty array.
 **/
function getBars() {
	var bars;

	try {
		bars = window.localStorage.getItem("bookmarkBars");

		if(bars != null) {
			bars = bars.split(";");
		} else {
			bars = [];
		}
	} catch(e) {
		log("getBars(); " + bars);
		log(e);

		bars = [];
	}
	
	return bars;
}

/**
 * Saves the array of bookmark bar names as a string in the html 5 localStorage.
 * The array is serialized with a semicolon separator.
 **/
function saveBars(bars) {
	try {
		window.localStorage.removeItem("bookmarkBars");
		window.localStorage.setItem("bookmarkBars", bars.join(";"));
	} catch(e) {
		log("saveBars();");
		log(e);
	}
}

/**
 * Load the meta data from the bookmarks. If no meta data is saved we can
 * assume that this is the first time BBS has been run on this browser
 * and create meta data containing the default name. The reason we create
 * a bookmark containing the default meta data here instead of in the calling
 * function is because we can't return the value of currentBB. Instead we 
 * have to use a global variable which makes the process asynchronous forcing
 * us to have the logic for handling non-existent meta data here.
 **/
function loadMetaData() {
	chrome.bookmarks.search("CurrentBB:", function(results) {
		if(results.length == 0) {
			// No meta data found, save the default name.
			setMetaData("Default");
		} else if(results.length == 1) {
			// Load the name from the bookmark title and save it globally.
			var temp = results[0].title;
			currentBB = temp.split(":")[1];
		}
	});
}

/**
 * Saves the currently selected bookmark bar name so that the extension
 * is compatible with bookmark syncers. This way when the user syncs a
 * specific bookmark bar on one machine the other machines will also know
 * which bookmark bar it is.
 **/
function setMetaData(name) {
	currentBB = name;
	
	// Delete the current meta data if any is found.
	chrome.bookmarks.search("CurrentBB:", function(results) {
		if(results.length == 1) {
			chrome.bookmarks.remove(results[0].id);
		}
	});

	// Find the Other Bookmarks folder and add the meta data as a bookmark.
	chrome.bookmarks.create({parentId: bookmarkBarsId,
		title: "CurrentBB:" + currentBB, url: "http://zoeetrope.com/en/bookmarkbar_switcher"});
}

function log(message) {
	if(loggingEnabled) {
		console.log(message);
	}
}

function clearStorage() {
	window.localStorage.clear();
}
