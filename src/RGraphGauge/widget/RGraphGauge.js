/*global logger */
/*
    RGraph Gauge Charts
    ========================

    @file      : RGraphGauge.js
    @version   : 1.2.0
    @author    : Ivo Sturm
    @date      : 06-10-2018
    @copyright : First Consulting
    @license   : Apache 2

    Documentation
    ========================
    Add a Gauge chart based on the RGraph library to your application. Version 1.0 of the widget includes both an original odometer like gauge and a semicircular progressbar. 
	For the latter both canvas and SVG rendering are supported. The user has full flexibility on the styling of the gauges by determining color sections for the gauges.
	
	Versions
	========================
	v1.1.0 - Fix for bug when page is refreshed, not recreating widget since uninitialize did not go well
	v1.1.1 - Fix for bug when using a non-zero starting value for the gauge.
	v1.2.0 - Added subscriptions so Gauge Chart will update if Value is changed and a refresh in client is done.
	
*/

// Required module list. 
define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dijit/_TemplatedMixin",
    "mxui/dom",
    "dojo/dom",
	"dojo/on",
    "dojo/dom-style",
    "dojo/_base/array",
    "dojo/_base/lang",
	"dojo/text",
    "dojo/text!RGraphGauge/widget/template/RGraphGauge.html",
    "RGraphGauge/lib/RGraph.common.core",
	"RGraphGauge/lib/RGraph.common.dynamic",
	"RGraphGauge/lib/RGraph.common.tooltips",
	"RGraphGauge/lib/RGraph.common.zoom",
	"RGraphGauge/lib/RGraph.semicircularprogress",
	"RGraphGauge/lib/RGraph.gauge",
	"RGraphGauge/lib/RGraph.svg.common.core",
	"RGraphGauge/lib/RGraph.svg.semicircularprogress"
], function(declare, _WidgetBase, _TemplatedMixin, dom, dojoDom, on, dojoStyle, dojoArray, dojoLang, dojoText, widgetTemplate) {
    "use strict";
    // Declare widget's prototype.
    return declare("RGraphGauge.widget.RGraphGauge", [ _WidgetBase, _TemplatedMixin ], {
        // _TemplatedMixin will create our dom node using this HTML template.
        templateString: widgetTemplate,

        // DOM elements
        RGraphGauge: null,
		cvs: null,

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _handles: null,
        _contextObj: null,
		_progressID: null,
		_gauge: null,
		_options: {},
		_logNode: 'RGraphGauge: ',
		_titleSpace: 10,

        // dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
        constructor: function() {

            logger.debug(this.id + ".constructor");
            this._handles = [];
			this._gauge = null;
			this._options = {};
        },

        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
        postCreate: function() {
            logger.debug(this.id + ".postCreate");

			this.domNode.width = this.size;	
			
			// set dimensions based on widget settings
			this.cvs.width = this.size;
			this.cvs.height = this.size * (2/3) + this._titleSpace;
			
			// update canvas id to make multiple graphs on one Mendix page possible. id is targeted later on whilst creating the graph
			this.cvs.id = "cvs_" + this.domNode.id;
						
        },

		resize: function(){

			// when resize is triggered (also after postCreate) size the canvas
			if(this._gauge){
				RGraph.redraw();
				//console.log(this._logNode + 'resizing to width, height: ' + this.size + "px, " + this.size + 'px.');
			}
		},
        // mxui.widget._WidgetBase.update is called when context is changed or initialized. Implement to re-render and / or fetch data.
        update: function(obj, callback) {
			this._contextObj = obj;
            //console.log(".update");
            this._resetSubscriptions();
            this._updateRendering();

            if (typeof callback !== "undefined") {
              callback();
            }
        },

        // mxui.widget._WidgetBase.uninitialize is called when the widget is destroyed. Implement to do special tear-down work.
        uninitialize: function() {

        },
        _drawChart: function() {

			// Widget configured variables
			var value = this._contextObj ? Number(this._contextObj.get(this.valueAttr)) : 0;
			var minValue = this._contextObj ? Number(this._contextObj.get(this.minValueAttr)) : 0;
			var maxValue = this._contextObj ? Number(this._contextObj.get(this.maxValueAttr)) : 100;
			
			// set color based on color attribute chosen. The attribute color always overrules the gauge sections color
			var color = this._contextObj ? this._contextObj.get(this.colorAttr) : "";
			this.range = maxValue - minValue;
			
			// truncate when over the maximum or under the minimum
			if(value >= maxValue){
				value = maxValue;
			} else if(value <= minValue) {
				value = minValue;
			}

			var rangeLength = (maxValue - minValue);
			var percentageValue = ((value - minValue) / rangeLength);
			
			// Build up array with the sections in it. Will be used in rendering the gauge sections later on.
			var colorArr = this.colorArray;
			var colorRanges = [];
			
			// this variable will be used to validate the ranges set in the Modeler. Only when all ranges are set correctly the graph will be built.
			var rangesValidated = true;
			var rangeMessage = "";
			
			var resizeWidth = (maxValue - minValue) / 100 ;

			// if gauge sections are configured and color attribute is not chosen, set color based on gauge sections
			if (colorArr.length > 0 && !color){
				this.areaArray = [];

				for (var i = 0; i < colorArr.length; i++){
					var colorRange = [];
					var areaObj = {
						start : (colorArr[i].rangeStart / 100),
						end : (colorArr[i].rangeEnd / 100),
						color : colorArr[i].colorSection
					};
					this.areaArray.push(areaObj);	
					colorRange.push(minValue + (colorArr[i].rangeStart * resizeWidth));
					colorRange.push(minValue + (colorArr[i].rangeEnd * resizeWidth));
					colorRange.push(colorArr[i].colorSection); 
					colorRanges.push(colorRange);
				}
				this.noTicks = colorArr.length ;
				
				// always sort the array on the rangeEnd attribute. Will help if not put in right order in the Modeler.
				this.areaArray.sort(function(a, b) {
					return parseFloat(a.end) - parseFloat(b.end);
				});
				
				// check if range starts with 0 and ends with 1
				var rangeCorrect = true;
				
				var maxFound = false;
				
				for (var k = 0 ; k < this.areaArray.length ; k++){
					
					// check if first object starts at zero
					if (k === 0){
						if (this.areaArray[k].start != 0){
							rangeCorrect = false;
							rangeMessage = 'The first Range should start at 0. Please correct the widget settings! ';
							rangesValidated = false;
						} 
					} 
					// check if subsequent objects are joining
					else {
						if (rangeEnd != this.areaArray[k].start){
							rangeCorrect = false;
							rangeMessage += 'Subsequent ranges should start at the end of the previous range. Please correct the widget settings! ';
							rangesValidated = false;
						}
					}
					// store rangeEnd so can be used in next iteration to check the rangeStart;	
					var rangeEnd = this.areaArray[k].end;
					
					if (this.areaArray[k].end == 1){
						maxFound = true;
					}
					// actually set the color dynamically based on what ranges it falls into
					if (percentageValue >= this.areaArray[k].start && percentageValue < this.areaArray[k].end){
						color = this.areaArray[k].color;
					}			
					
				}
				
				if (maxFound == false) {
					rangeMessage += 'The last range should end at 100. Please correct the widget settings!';
					rangesValidated = false;
				}
				
				if (maxFound && rangeMessage == ""){
					
					
				} else {
					// place errormessage in browser console and where Gauge should be shown
					console.error(this._logNode + rangeMessage);
					this.domNode.innerHTML = '<br>' + this._logNode + rangeMessage;
					this.domNode.style.color = 'red';
					this.domNode.style.fontStyle = 'italic';
				}
			
			}
			// now color should be known, either by color attribute or gauge sections
			else if (!color) {
				rangeMessage = "Please configure the Gauge Sections and/or select a color attribute! If not needed, let the range start at 0, end at 100 and set color to transparent!";
				rangesValidated = false;
				// place errormessage in browser console and where Gauge should be shown
				console.error(this._logNode + rangeMessage);
				this.domNode.innerHTML = '<br>' + this._logNode + rangeMessage;
				this.domNode.style.color = 'red';
				this.domNode.style.fontStyle = 'italic';
			}
			// only if ranges are ok and a for the gauge color is known, try to plot the gauge
			if (rangesValidated && color){
			
				// if gradient is selected, adjust color statement
				if (this.colorGradient){
					color = "Gradient(" + this.colorGradient + ":" + color + ")";
				}
				// default start and end angle
				var startingAngle = Math.PI;
				var endingAngle = 2 * Math.PI;
				
				// start center by default in middle, leaving space for the title, if half a circle (PI to TWOPI) is chosen
				var centerY = (this.size/2 + this._titleSpace);			
				
				var radius = ((this.size / 2) - (this._titleSpace));
				
				if (this.ringWidth > radius){
					var widthMessage = "the width (" + this.ringWidth + ") of the gauge is set to be larger than the radius (" + radius + ") . Please adjust in the widget settings!";
					// place errormessage in browser console and where Gauge should be shown
					console.error(this._logNode + widthMessage);
					this.domNode.innerHTML = '<br>' + this._logNode + widthMessage;
					this.domNode.style.color = 'red';
					this.domNode.style.fontStyle = 'italic';
				}
						
				// set general appearance options based on Modeler widget settings. Setting textAccesible = false is needed to circumvent a bug in RGraph, not showing labels anymore when reload is continuously being done.
				this._options = {
					textAccessible: true,
					adjustable: false,
					unitsPost: this.unitsPost,
					scaleDecimals: this.scaleDecimals,
					scalePoint: this.scalePoint,
					scaleThousand: this.scaleThousand,				
					labelsMinSize: 16,
					labelsMaxSize: 16,
					eventsClick: dojoLang.hitch(this,function (e, shape) {
						this._execMF(this.onClickMF,this._contextObj.getGuid());
					}),
					// by returning a truthy value from the handler function this allows us to change the cursor to pointer when the mouse is moved over a gauge. Because this is a common operation the pointer is automatically changed back to the previous state when it is moved away from the gauge.
					eventsMousemove: dojoLang.hitch(this,function (e, shape) {
						return true;
					}),
					title: this.chartTitle,
					titleSize: this._titleSpace,
					titleFont: "sans-serif",
					gutterTop: this._titleSpace,
					gutterLeft:20,
					gutterRight:20,
					textColor: this.textColor,
					titleColor: this.textColor,
					centery: centerY,
				
					radius: radius
							
				};
				if (this.gaugeType == "Semicircular"){
					// set Semicircular specific options
					this._options.colors = [color];
					this._options.width = this.ringWidth;
					this._options.anglesStart = startingAngle;
					this._options.anglesEnd = endingAngle;
					this._options.strokestyle = this.strokeStyle;
					

					if (this.displayValue){
						this._options.labelsCenter = true;
						this._options.labelsCenterColor = this.textColor;
						this._options.labelsCenterSize = this.labelsCenterSize;
					} else {
						this._options.labelsCenter = false;
					}
					if (this.renderingType == 'canvas'){
						this._gauge = new RGraph.SemiCircularProgress ({
							id: this.cvs.id,
							min: minValue,
							max: maxValue,
							value: value,
							options: this._options
						});
						
						this._gauge.grow({frames: this.easingDuration});
					}
									
					else if (this.renderingType == 'svg'){
						this._options.titleY = this._titleSpace + 2;
						// set the stroke / border coloring of the gauge
						this._options.backgroundStroke = this.strokeStyle;		
						this._options.backgroundFill = this.backgroundFill;	
						
						// if using SVG target the div domNode instead of the canvas element
						this._gauge = new RGraph.SVG.SemiCircularProgress ({
							id: this.domNode.id,
							min: minValue,
							max: maxValue,
							value: value,
							options: this._options
						});
						
						this._gauge.grow({	frames: this.easingDuration,
											callback: dojoLang.hitch(this,function (){
												// for no apparent reason, if multiple SVG gauges are added, the callback is only effective for one of the gauges randomly.
												// a timeout fixes this...
												window.setTimeout(dojoLang.hitch(this,function(){
													 this._gauge.path.onclick = dojoLang.hitch(this, function (e){
														 this._execMF(this.onClickMF,this._contextObj.getGuid());
													 });
													 this._gauge.path.onmousemove = dojoLang.hitch(this, function (e){
														 e.target.style.cursor = 'pointer';
													 });
												}),1000);
												 
											})
						});
					}
				} else if (this.gaugeType == "Original"){
					
					// always set height fully
					this.cvs.height = this.size + this._titleSpace;	
									
					// set Original specific options.
					this._options.colorsRanges = colorRanges;
					this._options.needleType = this.needleType;
					this._options.needleWidth = this.needleWidth;
					this._options.centerpinColor = this.centerPinColor;
					this._options.centerpinRadius = this.centerPinRadius;
					this._options.needleColors = [this.needleColors];
					
					if (this.displayValue){
						this._options.valueText = true;
						this._options.valueTextColor = this.textColor;
						this._options.valueTextBoundingStroke = 'transparent';
						this._options.valueTextYPos = 0.3;
					}
					this._gauge = new RGraph.Gauge ({
						id: this.cvs.id,
						min: minValue,
						max: maxValue,
						value: value,
						options: this._options
					});
					this._gauge.grow({frames: this.easingDuration});
				}
				
				// if svg chosen, no need for canvas element, hence destroy from DOM
				if (this.renderingType == "svg"){
					dojo.destroy(this.cvs);
				}	

			}
        },
        // Rerender the interface.
        _updateRendering: function() {
            logger.debug(this.id + "._updateRendering");

            // Draw or reload.
            if (this._contextObj !== null) {
				this._drawChart();
            }  else {
                dojoStyle.set(this.domNode, "display", "none"); // Hide widget dom node.
            }

        },
      // Reset subscriptions.
        _resetSubscriptions: function () {
            logger.debug(this.id + "._resetSubscriptions");
	
            var _objectHandle = null;
			var _attrHandle = null;

            // Release handles on previous object, if any.
            if (this._handles) {
                dojoArray.forEach(this._handles, function (handle, i) {
                    mx.data.unsubscribe(handle);
                });
                this._handles = [];
            }

            // When a mendix object exists create subscribtions.
            if (this._contextObj) {
                _objectHandle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: dojoLang.hitch(this, function (guid) {
						
                        this._updateRendering();
                    })
                });

				_attrHandle = this.subscribe({
					guid: this._contextObj.getGuid(),
					attr: this.valueAttr,
					callback: dojoLang.hitch(this, function(guid, attr, attrValue) {
						
                        this._updateRendering();
					})
				});
	
                this._handles = [_objectHandle, _attrHandle];
            }
			
        },
		_showProgress: function () {
			this._progressID = mx.ui.showProgress();
		},
		_hideProgress: function () {
			if (this._progressID){
				mx.ui.hideProgress(this._progressID);
				this._progressID = null;
			}
		},
			
		_execMF: function (mf, guid, cb) {
			if (mf && guid) {
				this._progressID = mx.ui.showProgress();
				mx.ui.action(this.onClickMF,{
							params:	{
								applyto: 'selection',
								guids: [guid]

							},
							progress: "modal",
							origin: this.mxform,
							error: dojoLang.hitch(this,function(error) {
								console.log(error.description);
								console.log(guid);
								this._hideProgress();
							}),
							callback: dojoLang.hitch(this,function(result){	
								this._hideProgress();
							})						
				},this);
			}
		},
		_cleanUpDomNode: function(node,callback) {
				
            while (node.firstChild ) {
				
               node.removeChild(node.firstChild);
			   			   
            }
			RGraph.ObjectRegistry.clear();
			if (typeof callback !== "undefined") {
             dojoLang.hitch(this, function(){
				 callback();
			 })
            }

        }

    });
});

require(["RGraphGauge/widget/RGraphGauge"], function() {
    "use strict";
});
