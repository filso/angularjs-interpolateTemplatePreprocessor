angular.module('decorators')
  .config(function($provide) {
    var startSymbol = "[[[",
      endSymbol = "]]]";
    var startSymbolLength = startSymbol.length,
      endSymbolLength = endSymbol.length;
    $provide.decorator("$templateCache",
      function($delegate, $injector, $parse, $rootScope, $http) {

        var interpolate = function interpolate(text, mustHaveExpression) {
          var startIndex,
            endIndex,
            index = 0,
            parts = [],
            length = text.length,
            hasInterpolation = false,
            fn,
            exp,
            concat = [];

          while (index < length) {
            if (((startIndex = text.indexOf(startSymbol, index)) != -1) &&
              ((endIndex = text.indexOf(endSymbol, startIndex + startSymbolLength)) != -1)) {
              (index != startIndex) && parts.push(text.substring(index, startIndex));
              parts.push(fn = $parse(exp = text.substring(startIndex + startSymbolLength, endIndex)));
              fn.exp = exp;
              index = endIndex + endSymbolLength;
              hasInterpolation = true;
            } else {
              // we did not find anything, so we have to add the remainder to the parts array
              (index != length) && parts.push(text.substring(index));
              index = length;
            }
          }

          if (!(length = parts.length)) {
            // we added, nothing, must have been an empty string.
            parts.push('');
            length = 1;
          }

          if (!mustHaveExpression || hasInterpolation) {
            concat.length = length;
            fn = function(context) {
              try {
                for (var i = 0, ii = length, part; i < ii; i++) {
                  if (typeof(part = parts[i]) == 'function') {
                    part = part(context);
                    if (part == null || part == undefined) {
                      part = '';
                    } else if (typeof part != 'string') {
                      part = toJson(part);
                    }
                  }
                  concat[i] = part;
                }
                return concat.join('');
              } catch (err) {
                var newErr = new Error('Error while interpolating: ' + text + '\n' + err.toString());
                $exceptionHandler(newErr);
              }
            };
            fn.exp = text;
            fn.parts = parts;
            return fn;
          }
        }

        var origPutMethod = $delegate.put;
        var origGetMethod = $delegate.get;

        var promises = {};

        // when we put in cache, we put already interpolated
        // on production this is run immediately - template.js
        $delegate.put = function(url, template) {
          template = interpolate(template)($rootScope);
          return origPutMethod(url, template);
        };

        $delegate.get = function(url) {
          var template = origGetMethod(url);
          if (typeof(template) === "undefined") {

            // need to keep track of independent promises, because there might be one template requested many times in pararrel
            if (typeof(promises[url]) === "undefined") {
              promises[url] = $http.get(url).then(function(response) {

                var ret = $delegate.put(url, response.data); // this will interpolate
                response.data = ret;
                return response;
              });
            }
            return promises[url];
          } else {
            return template;
          }
        };

        return $delegate;
      });
  });