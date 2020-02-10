// version: 2020-02-01
    // o--------------------------------------------------------------------------------o
    // | This file is part of the RGraph package - you can learn more at:               |
    // |                                                                                |
    // |                         https://www.rgraph.net                                 |
    // |                                                                                |
    // | RGraph is licensed under the Open Source MIT license. That means that it's     |
    // | totally free to use and there are no restrictions on what you can do with it!  |
    // o--------------------------------------------------------------------------------o

    RGraph = window.RGraph || {isrgraph:true,isRGraph: true,rgraph:true};

// Module pattern
(function (win, doc, undefined)
{
    var ua  = navigator.userAgent;

    //
    // This is used in two functions, hence it's here
    //
    RGraph.tooltips     = {};
    RGraph.tooltips.style = {
        display:    'inline-block',
        position:   'absolute',
        padding:    '6px',
        fontFamily: 'Arial',
        fontSize:   '10pt',
        fontWeight: 'normal',
        textAlign:  'center',
        left:       0,
        top:        0,
        backgroundColor: 'rgb(255,255,239)',
        color:      'black',
        visibility: 'visible',
        zIndex:     3,
        borderRadius: '5px',
        boxShadow:  'rgba(96,96,96,0.5) 0 0 5px',
        opacity:    0,
        lineHeight: RGraph.ISIE ? 'normal' : 'initial'
    };



    //
    // Shows a tooltip next to the mouse pointer
    // 
    // @param object object The canvas element object
    // @param string text   The tooltip text
    // @param int    x      The X position that the tooltip should appear at. Combined with the canvases offsetLeft
    //                      gives the absolute X position
    // @param int    y      The Y position the tooltip should appear at. Combined with the canvases offsetTop
    //                      gives the absolute Y position
    // @param int    index  The index of the tooltip in the graph objects tooltip array
    // @param object event  The event object
    //
    RGraph.tooltip = function ()
    {
        var args = RGraph.getArgs(arguments, 'object,text,x,y,index,event');

        if (RGraph.trim(args.text).length === 0) {
            return;
        }



        //
        // Fire the beforetooltip event
        //
        RGraph.fireCustomEvent(args.object, 'onbeforetooltip');



        //
        // tooltipOverride allows you to totally take control of rendering the tooltip yourself
        //
        if (typeof args.object.get('tooltipsOverride') == 'function') {
            return args.object.get('tooltipsOverride')(
                args.object,
                args.text,
                args.x,
                args.y,
                args.index
            );
        }




        //
        // Save the X/Y coords
        //
        var originalX = args.x;
        var originalY = args.y;

        //
        // This facilitates the "id:xxx" format
        //
        args.text = RGraph.getTooltipTextFromDIV(args.text);

        //
        // First clear any exising timers
        //
        var timers = RGraph.Registry.get('tooltip.timers');

        if (timers && timers.length) {
            for (i=0; i<timers.length; ++i) {
                clearTimeout(timers[i]);
            }
        }
        RGraph.Registry.set('tooltip.timers', []);

        //
        // Hide the context menu if it's currently shown
        //
        if (args.object.get('contextmenu')) {
            RGraph.hideContext();
        }



        //
        // Show a tool tip
        //
        if (typeof args.object.get('tooltipsCssClass') !== 'string' ) {
            args.object.set('tooltipsCssClass', 'RGraph_tooltip');
        }

        var tooltipObj       = document.createElement('DIV');
        tooltipObj.className = args.object.get('tooltipsCssClass');

        // Add the default CSS to the tooltip
        for (var i in RGraph.tooltips.style) {
            if (typeof i === 'string') {
                tooltipObj.style[i] = RGraph.tooltips.style[i];
            }
        }















        ///////////////////////////////////////
        // Do tooltip text substitution here //
        ///////////////////////////////////////
        function substitute (original)
        {
            if (args.object.type !== 'bar') {
                return original;
            }

            // Get hold of the indexes from the sequentialIndex that we have.
            //
            // TODO This will need updating for different chart types
            //

            var indexes = RGraph.sequentialIndexToGrouped(args.index, args.object.data);

            indexes = {
                  index: indexes[1],
                dataset: indexes[0],
        sequentialIndex: args.index
            };

            // This allows for escaping the percent
            var text = original.replace(/%%/g, '___--PERCENT--___')

            // First replacement to do is the indexes of the tooltip
            text = text.replace(/\[index\]/g, '[%{index}]');
            text = text.replace(/\[group\]/g, '[%{group}]');
            text = text.replace(/\[sequential_index\]/g, '[%{sequential_index}]');
            text = text.replace(/\[seq\]/g, '[%{sequential_index}]');

            // Replace the index of the tooltip
            text = text.replace(/%{index}/g, indexes.index);
            
            // Replace the dataset/group of the tooltip
            text = text.replace(/%{dataset}/g, indexes.dataset);
            text = text.replace(/%{group}/g, indexes.dataset);
            
            // Replace the sequentialIndex of the tooltip
            text = text.replace(/%{sequential_index}/g, indexes.sequentialIndex);
            text = text.replace(/%{seq}/g, indexes.sequentialIndex);

            // Do property substitution when there's an index to the property
            var reg = /%{prop(?:erty)?:([a-z0-9]+)\[([0-9]+)\]}/i;

            while (text.match(reg)) {

                var property = RegExp.$1;
                var index    = parseInt(RegExp.$2);

                if (args.object.properties[property]) {
                    text = text.replace(
                        reg,
                        args.object.properties[property][index] || ''
                    );
                
                // Get rid of the text
                } else {
                    text = text.replace(reg,'');
                }
                    
                RegExp.lastIndex = null;
            }




            // Third, replace this: %%property:xxx%%
            while (text.match(/%{property:([a-z0-9]+)}/i)) {
                var str = '%{property:' + RegExp.$1 + '}';
                text    = text.replace(str, args.object.properties[RegExp.$1]);
            }




            // Fourth, replace this: %%prop:xxx%%
            while (text.match(/%{prop:([a-z0-9]+)}/i)) {
                var str = '%{prop:' + RegExp.$1 + '}';
                text    = text.replace(str, args.object.properties[RegExp.$1]);
            }




            // Fifth and sixth, replace this: %%value%% and this: %%value_formatted%%
            while (text.match(/%{value(?:_formatted)?}/i)) {
            
// Get the value from the object type using the sequential index
switch (args.object.type) {
    case 'bar':
        var value = args.object.data_arr[args.index];
        break;
    default:
        alert('Not implemented yet!');
}

                if (text.match(/%{value_formatted}/i)) {
                    text = text.replace(
                        '%{value_formatted}',
                        RGraph.numberFormat({
                            object:   args.object,
                            number:   value.toFixed(args.object.properties.tooltipsValueFormattedDecimals),
                            thousand: args.object.properties.tooltipsValueFormattedThousand || ',',
                            point:    args.object.properties.tooltipsValueFormattedPoint    || '.'
                        })
                    );
                } else {
                    text = text.replace('%{value}', value);
                }
            }





            
            // Replace line returns with br tags
            text = text.replace(/\r?\n/g, '<br />');
            text = text.replace(/___--PERCENT--___/g, '%')

        
            return text.toString();
        }

        // Save the original text on the tooltip
        tooltipObj.__original_text__  = args.text;

        args.text = substitute(args.text);












        tooltipObj.innerHTML  = args.text;
        tooltipObj.__text__   = args.text; // This is set because the innerHTML can change when it's set
        tooltipObj.__canvas__ = args.object.canvas;
        tooltipObj.id         = '__rgraph_tooltip_' + args.object.canvas.id + '_' + args.object.uid + '_'+ args.index;
        tooltipObj.__event__  = args.object.get('tooltipsEvent') || 'click';
        tooltipObj.__object__ = args.object;

        if (typeof args.index === 'number') {
            tooltipObj.__index__ = args.index;
            origIdx = args.index;
        }

        if (args.object.type === 'line' || args.object.type === 'radar') {
            for (var ds=0; ds<args.object.data.length; ++ds) {
                if (args.index >= args.object.data[ds].length) {
                    args.index -= args.object.data[ds].length;
                } else {
                    break;
                }
            }
            
            tooltipObj.__dataset__ = ds;
            tooltipObj.__index2__  = args.index;
        }

        document.body.appendChild(tooltipObj);
        //obj.canvas.parentNode.appendChild(tooltipObj);

        var width  = tooltipObj.offsetWidth;
        var height = tooltipObj.offsetHeight;


        //
        // Set the width on the tooltip so it doesn't resize if the window is resized
        //
        tooltipObj.style.width = width + 'px';









        //
        // position the tooltip on the mouse pointers position
        //
        var mouseXY  = RGraph.getMouseXY(args.event);
        var canvasXY = RGraph.getCanvasXY(args.object.canvas);

        // Position based on the mouse pointer coords on the page
        tooltipObj.style.left = args.event.pageX - (parseFloat(tooltipObj.style.paddingLeft) + (width / 2)) + 'px';
        tooltipObj.style.top  = args.event.pageY - height - 10 + 'px';
        
        // If the left is less than zero - set it to 5
        if (parseFloat(tooltipObj.style.left) <= 5) {
            tooltipObj.style.left = '5px';
        }

        // If the tooltip goes over the right hand edge then
        // adjust the positioning
        if (parseFloat(tooltipObj.style.left) + parseFloat(tooltipObj.style.width) > window.innerWidth) {
            tooltipObj.style.left  = ''
            tooltipObj.style.right = '5px'
        }
        
        // If the canvas has fixed positioning then set the tooltip position to
        // fixed too
        if (RGraph.isFixed(args.object.canvas)) {
            var scrollTop = window.scrollY || document.documentElement.scrollTop;

            tooltipObj.style.position = 'fixed';
            tooltipObj.style.top = args.event.pageY - scrollTop - height - 10 + 'px';
        }
        
        
        
        
        
        
        // If the effect is fade:
        // Increase the opacity from its default 0 up to 1 - fading the tooltip in
        if (args.object.get('tooltipsEffect') === 'fade') {
            for (var i=1; i<=10; ++i) {
                (function (index)
                {
                    setTimeout(function ()
                    {
                        tooltipObj.style.opacity = index / 10;
                    }, index * 25);
                })(i);
            }
        } else {
            tooltipObj.style.opacity = 1;
        }











        //
        // If the tooltip itself is clicked, cancel it
        //
        tooltipObj.onmousedown = function (e){e.stopPropagation();}
        tooltipObj.onmouseup   = function (e){e.stopPropagation();}
        tooltipObj.onclick     = function (e){if (e.button == 0) {e.stopPropagation();}}







        //
        // Keep a reference to the tooltip in the registry
        //
        RGraph.Registry.set('tooltip', tooltipObj);

        //
        // Fire the tooltip event
        //
        RGraph.fireCustomEvent(args.object, 'ontooltip');
    };








    //
    // 
    //
    RGraph.getTooltipTextFromDIV = function ()
    {
        var args = RGraph.getArgs(arguments, 'text');

        // This regex is duplicated firher down on roughly line 888
        var result = /^id:(.*)/.exec(args.text);

        if (result && result[1] && document.getElementById(result[1])) {
            args.text = document.getElementById(result[1]).innerHTML;
        } else if (result && result[1]) {
            args.text = '';
        }
        
        return args.text;
    };








    //
    // Get the width that is set on the tooltip DIV based on the text
    // that has been given
    //
    RGraph.getTooltipWidth = function ()
    {
        var args = RGraph.getArgs(arguments, 'text,object');

        var div = document.createElement('DIV');
            div.className             = args.object.get('tooltipsCssClass');
            div.style.paddingLeft     = RGraph.tooltips.padding;
            div.style.paddingRight    = RGraph.tooltips.padding;
            div.style.fontFamily      = RGraph.tooltips.font_face;
            div.style.fontSize        = RGraph.tooltips.font_size;
            div.style.visibility      = 'hidden';
            div.style.position        = 'absolute';
            div.style.top            = '300px';
            div.style.left             = 0;
            div.style.display         = 'inline';
            div.innerHTML             = RGraph.getTooltipTextFromDIV(args.text);
        document.body.appendChild(div);

        return div.offsetWidth;
    };








    //
    // Hides the currently shown tooltip
    //
    RGraph.hideTooltip = function ()
    {
        var tooltip = RGraph.Registry.get('tooltip');
        var uid     = arguments[0] && arguments[0].uid ? arguments[0].uid : null;

        if (tooltip && tooltip.parentNode && (!uid || uid == tooltip.__canvas__.uid)) {
            tooltip.parentNode.removeChild(tooltip);
            tooltip.style.display = 'none';                
            tooltip.style.visibility = 'hidden';
            RGraph.Registry.set('tooltip', null);
        }
    };




    //
    // This (as the name suggests preloads any images it can find in the tooltip text
    // 
    // @param object obj The chart object
    //
    RGraph.preLoadTooltipImages = function ()
    {
        var args = RGraph.getArgs(arguments, 'object');

        var tooltips = args.object.get('tooltips');
        
        if (RGraph.hasTooltips(args.object)) {
        
            if (args.object.type == 'rscatter') {
                tooltips = [];
                for (var i=0; i<args.object.data.length; ++i) {
                    tooltips.push(args.object.data[3]);
                }
            }
            
            for (var i=0; i<tooltips.length; ++i) {
                // Add the text to an offscreen DIV tag
                var div = document.createElement('div');
                    div.style.position = 'absolute';
                    div.style.opacity = 0;
                    div.style.top = '-100px';
                    div.style.left = '-100px';
                    div.innerHTML  = tooltips[i];
                document.body.appendChild(div);
                
                // Now get the IMG tags and create them
                var img_tags = div.getElementsByTagName('IMG');
    
                // Create the image in an off-screen image tag
                for (var j=0; j<img_tags.length; ++j) {
                        if (img_tags && img_tags[i]) {
                        var img = document.createElement('img');
                            img.style.position = 'absolute';
                            img.style.opacity = 0;
                            img.style.top = '-100px';
                            img.style.left = '-100px';
                            img.src = img_tags[i].src
                        document.body.appendChild(img);
                        
                        setTimeout(function () {document.body.removeChild(img);}, 250);
                    }
                }
    
                // Now remove the div
                document.body.removeChild(div);
            }
        }
    };








    //
    // This is the tooltips canvas onmousemove listener
    //
    RGraph.tooltips_mousemove = function ()
    {
        var args                  = RGraph.getArgs(arguments, 'object,event'),
            shape                 = args.object.getShape(args.event),
            changeCursor_tooltips = false

        if (   shape
            && typeof shape.index === 'number'
            && args.object.get('tooltips')[shape.index]
           ) {

            var text = RGraph.parseTooltipText(
                args.object.get('tooltips'),
                shape.index
            );

            if (text) {

                //
                // Change the cursor
                //
                changeCursor_tooltips = true;

                if (args.object.get('tooltipsEvent') === 'onmousemove') {

                    // Show the tooltip if it's not the same as the one already visible
                    if (
                           !RGraph.Registry.get('tooltip')
                        || RGraph.Registry.get('tooltip').__object__.uid != args.object.uid
                        || RGraph.Registry.get('tooltip').__index__ != shape.index
                       ) {

                        RGraph.hideTooltip();
                        RGraph.clear(args.object.canvas);
                        RGraph.redraw();
                        RGraph.tooltip(
                            args.object,
                            text,
                            args.event.pageX,
                            args.event.pageY,
                            shape.index
                        );
                        args.object.highlight(shape);
                    }
                }
            }
        
        //
        // More highlighting
        //
        } else if (shape && typeof shape.index === 'number') {

            var text = RGraph.parseTooltipText(
                args.object.get('tooltips'),
                shape.index
            );

            if (text) {
                changeCursor_tooltips = true
            }
        }

        return changeCursor_tooltips;
    };








// End module pattern
})(window, document);
