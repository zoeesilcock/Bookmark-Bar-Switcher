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
var currentBarId;      // The bookmark holding the name of the current bar.

var loggingEnabled = true;

/**
 * Here we prepare the bookmark folders we need to do our job. It will first
 * find the id of the Other Bookmarks folder and save it (seriously google,
 * fix this). Next it will look for the BookmarksBars folder which contains
 * our meta data and the actual bookmark bars. If it doesn't find one it will
 * create one.
 *
 * This is called in the onload event of the background page body.
 **/
function initData() {
	chrome.bookmarks.getTree(function(bookmarks) {
		// Get the ids for the two root folders.
		otherBookmarksId = bookmarks[0].children[1].id;
		bookmarkBarId = bookmarks[0].children[0].id;

		// Look for our storage folder and create one if it isn't there.
		chrome.bookmarks.getChildren(otherBookmarksId, function(children) {
			children.forEach(function(item) {
				if(item.title == "BookmarkBars") {
					// Found the BookmarkBars folder, save the id.
					bookmarkBarsId = item.id;
				}
			});

			if(bookmarkBarsId == null) {
				// No BookmarkBars folder was found, create it.
				chrome.bookmarks.create({parentId: otherBookmarksId,
					title: "BookmarkBars"}, function(result) {
						bookmarkBarsId = result.id;

						// Since we didn't even have a BookmarkBars folder there can't
						// be any storage folders either, make one for the default bar.
						newBar("Default");
					});
			}
		});
	});
}

/**
 * Loads all the information about bookmark bars that we have saved. It
 * grabs all the children of the "BookmarkBars" folder and steps through them.
 * It adds all the folder names to the list of bookmark bars and extracts
 * the name of the current bar from the "CurrentBB:*" bookmark. This method
 * is called by the popup and it passes the populate function as the argument.
 * This allows us to update the view once the asynchronous calls to 
 * google.bookmarks have ended.
 **/
function loadData(populateView) {
	// Clear the current data.
	currentBB = null;
	var bookmarkBars = [];

	// Get a list of items in the "BookmarkBars" folder and go through them.
	chrome.bookmarks.getChildren(bookmarkBarsId, function(items) {
		items.forEach(function(item) {
			if(item.title.indexOf("CurrentBB:") != -1) {
				// This is the CurrentBB:* bookmark, extract the name.
				currentBB = item.title.split(":")[1];
				currentBarId = item.id;
			} else if(item.url == null) {
				// This is a bookmark bar storage folder, add it to the list of bars.
				bookmarkBars.push(item.title);
			}
		});

		if(currentBarId == null) {
			// The CurrentBB:* bookmark wasn't found, lets create it.
			chrome.bookmarks.create({parentId: bookmarkBarsId,
				title: "CurrentBB:Default", url: "http://zoeetrope.com/en/bookmarbar"}, 
				function(result) {
				currentBB = "Default";
				currentBarId = result.id;

				if(populateView != null) {
					populateView(bookmarkBars, currentBB);
				}
			});
		} else if(populateView != null) {
			populateView(bookmarkBars, currentBB);
		}
	});
}

/**
 * Changes the CurrentBB:* bookmark to contain the specified name instead.
 * It also updates the global variable where we keep the current bookmark
 * bar's name.
 **/
function setCurrentBB(name) {
	chrome.bookmarks.update(currentBarId, {title: "CurrentBB:" + name});
	currentBB = name;
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
function selectBar(name) {
	if(name != currentBB) {
		// Store the name of the current bar since setMetaData will change it
		// before we need it when moving out the old bookmarks.
		var current = currentBB;

		chrome.bookmarks.getChildren(bookmarkBarsId, function(folders) {
			// Go through the bookmark storage folders.
			folders.forEach(function(folder) {
				if(folder.title == current) {
					// We have found the storage folder for the current bar.
					// Move every bookmark in the bar to it's storage folder.
					chrome.bookmarks.getChildren(bookmarkBarId, function(items) {
						items.forEach(function(item) {
							chrome.bookmarks.move(item.id, {parentId: folder.id});
						});
					});
				}
			});

			// Go through the bookmark storage folders.
			folders.forEach(function(folder) {
				if(folder.title == name) {
					// We have found the storage folder for the selected bar.
					// Move every bookmark in the storage folder to the bookmark bar.
					chrome.bookmarks.getChildren(folder.id, function(items) {
						items.forEach(function(item) {
							chrome.bookmarks.move(item.id, {parentId: bookmarkBarId});
						});
					});
				}
			});
		});

		// Update the current bookmark bar meta data.
		setCurrentBB(name);
	}
}

/**
 * Creates a new bookmark bar by the name specified. It will check that the
 * name isn't already taken and if not create a storage folder for it. 
 **/
function newBar(name, createdCallback) {
	chrome.bookmarks.getChildren(bookmarkBarsId, function(folders) {
		var storageFound = false;
		var result;

		// Lets make sure this name isn't in use already.
		folders.forEach(function(folder) {
			if(folder.title == name) {
				storageFound = true;
			}
		});

		if(!storageFound) {
			// The storage folder wasn't found, good, create one.
			chrome.bookmarks.create({parentId: bookmarkBarsId, title: name});
		} else {
			result = "This name is taken.";
		}

		// Inform the view of how it went.
		if(createdCallback != null) {
			createdCallback(result);
		}
	});
}

/**
 * Simple logging function which outputs debug information to the console
 * if the loggingEnabled global boolean is set to true.
 **/
function log(message) {
	if(loggingEnabled) {
		console.log(message);
	}
}
