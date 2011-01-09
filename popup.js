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
 * The controller section of the Bookmark Bar Switcher extension. It is part
 * of the popup.html file and is responsible for taking user input and
 * forwarding it to the background page and vice versa.
 * 
 * @author Zoee Silcock
 **/ 

/**
 * This function requests the data needed for the view from the
 * background page. The data is sent back via a callback since the
 * loadData() method uses asynchronous methods. We pass the callback
 * as an argument to loadData(). 
 * 
 * This function is called from the onload event of the popup body.
 **/
function initView() {
	// Request the data from the background page.
	chrome.extension.getBackgroundPage().loadData(populate);
}

/**
 * As the name suggests this function populates the view with the
 * available bookmark bars. It highlights the one thats is in use.
 **/
function populate(bookmarkBars, currentBB) {
	// Build an array with the new list items.
	var ulItems = [];
	bookmarkBars.forEach(function(item) {
		if(item == currentBB) {
			ulItems.push('<li class="current">' + item + '</li>');
			} else {
			ulItems.push('<li onclick="selectBookmarkBar(\'' + item + '\')">' + item + '</li>');
		}
	});

	var list = document.getElementById("popup_list");
	list.innerHTML = ulItems.join("");
}

/**
 * Handles the new bookmark bar form by taking the name and calling the 
 * newBar() method on the background page. If no name was provided an 
 * error is displayed. The newBar() method will return an error if
 * the name is taken. For the sake of simplicity newBar() returns an 
 * error string if something went wrong and null otherwise.
 **/
function createBar() {
	var name = document.getElementById("barName").value;

	if(name.indexOf(":") != -1) {
		showError("The name can't contain a colon (:).");
		} else if(name.length > 0) {
		chrome.extension.getBackgroundPage().newBar(name, barCreated);
		} else {
		showError("Please provide a name.");
	}
}

/**
 * Receives the result of creating a new bookmark bar. If there was an
 * error it will receive a string to display, otherwise it will be null.
 **/
function barCreated(message) {
	if(message != null) {
		showError(message);
		} else {
		hidePopup();
	}
}

/**
 * Convenience method which closes the popup. 
 **/
function hidePopup() {
	javascript:window.close();
}

/**
 * Shows the error area with the specified message.
 **/
function showError(message) {
	var errorField = document.getElementById("error");
	errorField.innerHTML = message;
	errorField.style.display = "block";
}

/**
 * Shows the new bookmark bar form.
 **/
function showNameForm() {
	var nameFormDiv = document.getElementById("barNameDiv");
	nameFormDiv.style.display = "block";

	document.getElementById("barName").focus();
}

/**
 * Tells the background page to switch to the specified bookmark bar.
 **/
function selectBookmarkBar(bar) {
	chrome.extension.getBackgroundPage().selectBar(bar);
	hidePopup();
}

/**
 * Opens the bookmark manager allowing the user to edit the names, 
 * order and content of the bookmark bars. Hopefully we can link
 * directly to the BookmarkBars folder in the future.
 **/
function manageBars() {
	chrome.tabs.create({
		url: "chrome://bookmarks/"
	});
}
