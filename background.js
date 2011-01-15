/**
 * Copyright 2011 Zoee Silcock (zoeetrope.com)
 * 
 * This file is part of Bookmark Bar Switcher.
 * 
 * Bookmark Bar Switcher is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * Bookmark Bar Switcher is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with Bookmark Bar Switcher. If not, see <http://www.gnu.org/licenses/>.
 **/

/**
 * The model section of the Bookmark Bar Switcher extension. This is where
 * we do the real work. We are mainly dealing with data storage and shuffling
 * bookmarks back and forth.
 *
 * @author Zoee Silcock
 **/

/**
 * The name of the currently selected bookmark bar. It is set to default
 * since it is used to create the CurrentBB:* bookmark if none is found.
 **/
var currentBB = "Default";

/**
 * An array containing the BookmarkTreeNode objects corresponding to our
 * bookmark bar storage folders.
 **/
var bookmarkBars = [];

/**
 * The IDs to important bookmark folders.
 **/
var otherBookmarksId;  // Shouldn't be needed, come on Google.
var bookmarkBarId;     // Shouldn't be needed, come on Google.
var bookmarkBarsId;    // The root of our bookmark storage folder.
var currentBarId;      // The bookmark holding the name of the current bar.

var loggingEnabled = true;

/**
 * This is called from the onload event of the background.html page, when
 * the extension is loaded in other words.
 **/
function initialize() {
	initData();
	setupEventListeners();
}

/**
 * Here we prepare the bookmark folders we need to do our job. It will first
 * find the id of the Other Bookmarks folder and save it (seriously google,
 * fix this). Next it will look for the BookmarksBars folder which contains
 * our meta data and the actual bookmark bars. If it doesn't find one it will
 * create one.
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
						createBar("Default");
					});
			}

			loadData();
		});
	});
}

/**
 * Add listeners to the onChanged and onRemoved events so we can protect the
 * storage structure.
 **/
function setupEventListeners() {
	chrome.bookmarks.onChanged.addListener(handleBookmarkChange);
	chrome.bookmarks.onRemoved.addListener(handleBookmarkRemove);
}

/**
 * Loads all the information about bookmark bars that we have saved. It
 * grabs all the children of the "BookmarkBars" folder and steps through them.
 * It adds all the folder names to the list of bookmark bars and extracts
 * the name of the current bar from the "CurrentBB:*" bookmark. This method
 * is called by the popup and it passes the populate function as the argument.
 * This allows us to update the view once the asynchronous calls to 
 * google.bookmarks have ended. It is also called from the model when bookmark
 * bar names have changed for example.
 **/
function loadData(populateView) {
	// Clear the current data.
	bookmarkBars = [];

	// Get a list of items in the "BookmarkBars" folder and go through them.
	chrome.bookmarks.getChildren(bookmarkBarsId, function(items) {
		items.forEach(function(item) {
			if(item.title.indexOf("CurrentBB:") != -1) {
				// This is the CurrentBB:* bookmark, extract the name.
				currentBB = item.title.split(":")[1];
				currentBarId = item.id;
			} else if(item.url == null) {
				// This is a bookmark bar storage folder, add it to the list of bars.
				bookmarkBars.push(item);
			}
		});

		if(currentBarId == null) {
			// The CurrentBB:* bookmark wasn't found, lets create it.
			chrome.bookmarks.create({parentId: bookmarkBarsId,
				title: "CurrentBB:" + currentBB, url: "http://zoeetrope.com/en/bbs"}, 
				function(result) {
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

		chrome.bookmarks.getChildren(bookmarkBarsId, function(storageFolders) {
			storageFolders.forEach(function(storageFolder) {
				if(storageFolder.title == current) {
					// Move every bookmark in the bar to it's storage folder.
					moveChildrenToFolder(bookmarkBarId, storageFolder.id);
				}
			});

			storageFolders.forEach(function(storageFolder) {
				if(storageFolder.title == name) {
					// Move every bookmark in the storage folder to the bookmark bar.
					moveChildrenToFolder(storageFolder.id, bookmarkBarId);
				}
			});
		});

		// Update the current bookmark bar meta data.
		setCurrentBB(name);
	}
}

/**
 * Moves the children of the sourceId folder to the destinationId folder.
 **/
function moveChildrenToFolder(sourceId, destinationId) {
	chrome.bookmarks.getChildren(sourceId, function(items) {
		items.forEach(function(item) {
			chrome.bookmarks.move(item.id, {parentId: destinationId});
		});
	});
}

/**
 * Checks whether the bar name is valid and throws and exception if not.
 **/
function validateBarName(name) {
	if(name.indexOf(":") != -1) {
		throw("The name can't contain a colon.");
	} else if(name.length == 0) {
		throw("Please provide a name.");
	}
}

/**
 * Creates a new bookmark bar by the name specified. It will check that the
 * name isn't already taken and if not create a storage folder for it. 
 **/
function createBar(name, createdCallback) {
	chrome.bookmarks.getChildren(bookmarkBarsId, function(folders) {
		var result;

		try {
			validateBarName(name);

			// Lets make sure this name isn't in use already.
			folders.forEach(function(folder) {
				if(folder.title == name) {
					throw("This name is taken.");
				}
			});

			chrome.bookmarks.create({parentId: bookmarkBarsId, title: name});
		} catch (exception) {
			result = exception;
		}

		// Inform the view of how it went.
		if(createdCallback != null) {
			createdCallback(result);
		}
	});
}

/**
 * Event listener for the onChange event. This function doesn't handle the
 * event, it simply refers to the correct method that will handle it.
 **/
function handleBookmarkChange(id, changeInfo) {
	if(id == currentBarId) {
		handleManualCurrentBBChange(id, changeInfo);
	} else if(getStorageName(id) != null) {
		handleManualBarNameChange(id, changeInfo);
	}
}

/**
 * Event listener for the onRemoved event. We use this to protect our
 * CurrentBB:* bookmark since losing this results in various problems. 
 * By setting the currentBarId to null we force loadData() to create one 
 * using the currentBB global variable. This means that removing the 
 * CurrentBB:* bookmark while the extension is running has no effect, 
 * it is instantly recreated.
 **/
function handleBookmarkRemove(id, removeInfo) {
	if(id == currentBarId) {
		currentBarId = null;
		loadData();
	}
}

/**
 * This function handles the situation when the user has edited the Current:BB*
 * bookmark manually via the Bookmark manager. It makes sure edit is valid
 * and switches the bookmark bar if needed. If the new title isn't valid
 * we simply reset it to what it should be.
 **/
function handleManualCurrentBBChange(id, changeInfo) {
	var parts = changeInfo.title.split(":");
	var newName = parts[1];

	if(parts[0] == "CurrentBB" && newName != currentBB 
			&& getStorageId(newName) != null) {
		selectBar(newName);
	} else {
		chrome.bookmarks.update(id, {title: "CurrentBB:" + currentBB});
	}
}

/**
 * This function handles the situation when the user edits one of the storage
 * folders manually. It validates the name in a similar way to the createBar()
 * method and updates the CurrentBB:* bookmark if it was the current bar
 * that was changed. We also call loadData() so the bookmarkBars global array
 * is updated. That is needed if the user makes several edits manually without
 * opening the popup. If the new name was invalid we simply reset it.
 **/
function handleManualBarNameChange(id, changeInfo) {
	var newName = changeInfo.title;

	try {
		if(bookmarkBarExists(newName)) {
			throw "This name is taken.";
		}

		validateBarName(newName);

		if(id == getStorageId(currentBB)) {
			setCurrentBB(newName);
		}

		loadData();
	} catch(exception) {
		chrome.bookmarks.update(id, {title: getStorageName(id)});
		log(exception);
	}
}

/**
 * Utility function which uses the bookmarkBars global array to find the id
 * of the storage folder for the specified bookmark bar name. If no storage
 * folder was found it returns null.
 **/
function getStorageId(name) {
	var id;

	bookmarkBars.forEach(function(item) {
		if(item.title == name) {
			id = item.id;
		}
	});

	return id;
}

/**
 * Utility function which uses the bookmarkBars global array to find the name
 * of the bookmark bar whose storage folder has the specified id. If no
 * the id isn't a storage folder it will return null.
 **/
function getStorageName(id) {
	var name;

	bookmarkBars.forEach(function(item) {
		if(item.id == id) {
			name = item.title;
		}
	});

	return name;
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
