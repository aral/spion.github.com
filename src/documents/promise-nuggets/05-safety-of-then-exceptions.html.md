---
title: Safety of then - Exceptions
layout: nuggets
category: Introduction
date: 2007-01-05
---

We need to write a function that reads a config file and parses it as JSON. 
How can we do that safely?

#### Callbacks

With callbacks we will need to wrap JSON.parse in a `try catch` block. 

```js
function readConfig(file, callback) {
	fs.readFile(file, function(err, content) {
		if (err) return callback(err);
		var parsed;
		try { parsed = JSON.parse(content.toString()) }
		catch (error) { return callback(err); }
		callback(null, parsed);
	})
}
```

#### Promises

With promises no special treatment is required:

```js
function readConfig(file) {
	return fs.readFile(file).then(function(res) {
		return JSON.parse(content.toString());
	});
}
```

## Notes

In the callback example, we must be careful not to wrap the callback inside the
try statement! Otherwise, if an exception is thrown inside that callback, the 
catch block will call it again.

In the promises example, any exceptions thrown inside then will be propagated
as errors with the promise, and we can handle them in the error handler of that
promise:

```js
readConfig(file).done(function(config) {
	// Got configuration.
}, function(error) {
	// JSON parse error or file read error.
})
```