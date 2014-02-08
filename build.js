var fez = require('fez');

var Promise = require('bluebird');

var marked = Promise.promisify(require('marked'));

var yaml = require('js-yaml');

var fs = require('fs');
Promise.promisifyAll(fs);


// The default rule.
exports.default = function(spec) {
    spec.with('src/documents/**/*.md').each(function(file) {
        spec.rule(file,
                  file.map(replacer(/src\/documents\/(.+)\.md/, 'tmp/$1')),
                  meta(markdown()));
    });
    spec.with('tmp/**/*.html').each(function(file) {
        spec.rule(file, layoutsOf(file),
                  file.map(replacer('tmp/', 'tmp2/')),
                  applyLayouts);
    });
    spec.with(['src/documents/index.html.jade','tmp/**/*.html']).all(function(files) {
        spec.rule(files, 'tmp/index.html', buildIndex);
    });

}


function replacer(match, replace) {
    return function(string) {
        return string.replace(match, replace);
    }
}

function meta(processor) {
    return function(inputs, output) {
        return inputs[0].asBuffer()
        .then(extractMeta)
        .then(function(data) {
            return Promise.cast(data)
            .then(processor)
            .then(function(processed) {
                return [data.parts[0], data.parts[1], processed].join('---\n');
            });
        });
    }
}

function extractMeta(inp) {
    var metaBody = inp.toString().split(/--[-]+[\r\n]*/);
    while (metaBody.length < 3)
        metaBody.unshift('');
    return {
        parts: metaBody,
        meta: yaml.safeLoad(metaBody[1]),
        body: metaBody[2]
    }
}

function markdown(options) {
    return function (data) {
        if (!data || !data.body) return;
        if (options) marked.setOptions(options);
        return marked(data.body.toString());
    }
}


// Lazy layouts
function layoutsOf(file) {
    return function() {
        return file.inspect().asBuffer().then(getLayoutList);
    }
}


// Recursive layout fetcher
function getLayoutList(data) {
    data = extractMeta(data);
    if (data.meta && data.meta.layout) {
        var thisone = 'src/layouts/' + data.meta.layout + '.html.jade';
        return fs.readFileAsync(thisone)
        .then(getLayoutList)
        .then(function(list) {
            return [thisone].concat(list);
        });
    }
    else return [];
}

// Layout application operation
var jade = require('jade');
function applyLayouts(inputs) {
    var input = inputs[0].asBuffer(),
    initialDoc = input.then(extractMeta);
    var complete = Promise.cast(input.then(getLayoutList))
    .reduce(function(step, flayout) {
        return fs.readFileAsync(flayout).then(extractMeta).then(function(layout) {
            var template = jade.compile(layout.body);
            var body = template({document: step.meta, content: step.body});
            return { body: body, meta: step.meta };
        });
    }, Promise.cast(initialDoc));
    return complete.then(function(data) {
        return data.body;
    });
}

function buildIndex(inputs) {
    Promise.map(inputs, function(i) {
        return i.asBuffer().then(extractMeta);
    }).then(function(all) {
        var tmpl = all[0];
        var template = jade.compile(tmpl.body);
        var body = template({
            document: tmpl.meta,
            posts: all.slice(1)
        });
    });
}


// Fez it!
fez(module);

