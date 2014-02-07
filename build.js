var fez = require('fez');

var Promise = require('bluebird');

var marked = Promise.promisify(require('marked'));

var yaml = require('js-yaml');

var fs = require('fs');
Promise.promisifyAll(fs);


// The default rule.
exports.default = function(spec) {
    spec.with('src/documents/**/*.md').each(function(file) {
        spec.rule(file, file.map(function(name) { 
            return name.replace(/src\/documents\/(.+)\.md/, 'tmp/$1');
        }), meta(markdown()));
    });
    spec.with('tmp/**/*.html').each(function(file) {
        spec.rule(file, layoutsOf(file), file.map(function(name) {
            return name.replace('tmp/', 'tmp2/');
        }), applyLayout);
    });

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
    if (data.meta.layout) {
        var thisone = 'src/layouts/' + data.meta.layout + '.html.jade';
        var others = fs.readFileAsync(thisone)
            .then(getLayoutList)
            .then(function(list) {
                return [thisone].concat(list);
            });
    }
    else return [];
}

// Layout application operation
var jade = require('jade'), xtend = require('xtend');
function applyLayout(inputs) {   
    var input = inputs[0].asBuffer(),
        initialBody = input.then(extractMeta);
    return input.then(getLayoutList).reduce(function(step, layout) {
        return fs.readFileAsync(layout).then(extractMeta).then(function(layout) {
            var template = jade.compile(layout.body);
            return { 
                body: template(xtend(step.meta, {content: step.body})),
                layout: layout.meta.body
            };
        });
    }, initialBody);
}

// Fez it!
fez(module);

