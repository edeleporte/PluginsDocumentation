// Dimensions of sunburst.
var width = 750;
var height = 600;
var radius = Math.min(width, height) / 2;

// Breadcrumb dimensions: width, height, spacing, width of tip/tail.
var b = {
  w: 75, h: 30, s: 3, t: 10
};

var formatNumber = d3.format(",d");

var x = d3.scaleLinear()
    .range([0, 2 * Math.PI]);

var y = d3.scaleSqrt()
    .range([0, radius]);

//variable returning a colour value
var color = d3.scaleOrdinal(d3.schemeCategory20);

// Mapping of step names to colors.
var colors = {
	"other": "#a173d1",
	"end": "#bbbbbb"
};

// Total size of all segments; we set this later, after loading the data.
var totalSize = 0; 

var vis = d3.select("#chart_sunburst").append("svg:svg")
    .attr("width", width)
    .attr("height", height)
    .attr("id", "sunBurst_AllDocs")
    .append("svg:g")
    .attr("id", "container")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

var partition = d3.partition();

var arc = d3.arc()
    .startAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x0))); })
    .endAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x1))); })
    .innerRadius(function(d) { return Math.max(0, y(d.y0)); })
    .outerRadius(function(d) { return Math.max(0, y(d.y1)); });

//method creating the sunburst diagram
d3.json("/PluginsDocumentation/assets/s1606008_rcr/flare_4.json", function (error, root) {
    if (error) throw error;
    var test = getModelNode(root.children)
    //create sunburst visualization
    createVisualization(root);
});

// Main function to draw and set up the visualization, once we have the data.
function createVisualization(json) {

    // Basic setup of page elements.
    initializeBreadcrumbTrail();
  
    // Bounding circle underneath the sunburst, to make it easier to detect
    // when the mouse leaves the parent g.
    vis.append("svg:circle")
        .attr("r", radius)
        .style("opacity", 0);
    
    //setting up data for sunburst diagram
    var root = d3.hierarchy(json);

    //returns 1000 if this is a leaf node (no children) ...means i do not need 
    // a size property in my json data
    root.sum(function (d) { return (d.children ? 0 : d.size); });
 
    // For efficiency, filter nodes to keep only those large enough to see.
    var nodes = partition(root).descendants();
  
    var path = vis.data([json]).selectAll("#sunBurst_AllDocs svg path")
        .data(nodes)
        .enter().append("svg:path")
        .attr("display", function(d) { return d.depth ? null : "none"; })
        .attr("d", arc)
        .style("fill", function (d) { return color((d.children ? d : d.parent).data.Id); })
        .style("opacity", 1)
        .on("click", click)
        .on("mouseover", mouseover);
    
    //add data
    path.append("title")
        .text(function(d) { return d.data.name; });
    path.append("id")
        .text(function (d) { return d.data.Id; });
    path.append("NumberOfDocs")
        .text(function (d) { return d.data.size; });

    // Add the mouseleave handler to the bounding circle.
    d3.select("#container").on("mouseleave", mouseleave);

    // Get total size of the tree = value of root node from partition.
    totalSize = path.datum().value;
}

// Fade all but the current sequence, and show it in the breadcrumb trail.
function mouseover(d) {

  var percentage = (100 * d.value / totalSize).toPrecision(3);
  //add doc name to last if we are on a leaf node
  var percentageString = d.data.children? (d.value)+"("+ percentage + "%)" 
  : d.data.Id + " " + d.data.name +"("+ percentage + "%)";
  
  var sequenceArray = d.ancestors().reverse();
  sequenceArray.shift(); // remove root node from the array
  updateBreadcrumbs(sequenceArray, percentageString);

  // Fade all the segments.
  d3.select("svg#sunBurst_AllDocs")
    .selectAll("path")
    .style("opacity", 0.3);

  // Then highlight only those that are an ancestor of the current segment.
  vis.selectAll("path")
    .filter(function(node) {
        return (sequenceArray.indexOf(node) >= 0);
    })
    .style("opacity", 1);
}

//zoom in or out when clicking
function click(d) {
    vis.transition()
        .duration(750)
        .tween("scale", function() {
          var xd = d3.interpolate(x.domain(), [d.x0, d.x1]),
              yd = d3.interpolate(y.domain(), [d.y0, 1]),
              yr = d3.interpolate(y.range(), [d.y0 ? 100 : 100, radius]);
          return function(t) { x.domain(xd(t)); y.domain(yd(t)).range(yr(t)); };
        })
      .selectAll("path")
        .attrTween("d", function(d) { return function() { return arc(d); }; });
}

// Restore everything to full opacity when moving off the visualization.
function mouseleave(d) {

  // Hide the breadcrumb trail
  d3.select("#trail")
      .style("visibility", "hidden");

  // Deactivate all segments during transition.
  d3.select("svg#sunBurst_AllDocs")
    .selectAll("path")
    .on("mouseover", null);

  // Transition each segment to full opacity and then reactivate it.
  d3.select("svg#sunBurst_AllDocs")
    .selectAll("path")
      .transition()
      .duration(1000)
      .style("opacity", 1)
      .on("end", function() {
              d3.select(this).on("mouseover", mouseover);
            });
}

function initializeBreadcrumbTrail() {
  // Add the svg area.
  var trail = d3.select("#sequence").append("svg:svg")
      .attr("width", width)
      .attr("height", 50)
      .attr("id", "trail");
  // Add the label at the end, for the percentage.
  trail.append("svg:text")
    .attr("id", "endlabel")
    .style("fill", "#000");
}

// Generate a string that describes the points of a breadcrumb polygon.
function breadcrumbPoints(d, i) {
  var points = [];
  points.push("0,0");
  points.push(b.w + ",0");
  points.push(b.w + b.t + "," + (b.h / 2));
  points.push(b.w + "," + b.h);
  points.push("0," + b.h);
  if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
    points.push(b.t + "," + (b.h / 2));
  }
  return points.join(" ");
}

// Update the breadcrumb trail to show the current sequence and percentage.
function updateBreadcrumbs(nodeArray, percentageString) {

  // Data join; key function combines name and depth (= position in sequence).
  var trail = d3.select("#trail")
      .selectAll("g")
      .data(nodeArray, function(d) { return d.data.name + d.depth; });

  // Remove exiting nodes.
  trail.exit().remove();

  // Add breadcrumb and label for entering nodes.
  var entering = trail.enter().append("svg:g");

  entering.append("svg:polygon")
      .attr("points", breadcrumbPoints)
      .attr("style", function (d) {
        return vis.selectAll("path") //select all path elements in svg container
        .filter(function (node) {   //iterate over each path element (node)
            return (node.data.Id === d.data.Id); //and check whether its data id is matching current node (d) data id
        })
        .attr("style");
    })

  entering.append("svg:text")
      .attr("x", (b.w + b.t) / 2)
      .attr("y", b.h / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text(function(d) { return d.data.Id; });

  // Merge enter and update selections; set position for all nodes.
  entering.merge(trail).attr("transform", function(d, i) {
    return "translate(" + i * (b.w + b.s) + ", 0)";
  });

  // Now move and update the percentage at the end.
  d3.select("#trail").select("#endlabel")
      .attr("x", (nodeArray.length + percentageString.length * .01) * (b.w + b.s))
      .attr("y", b.h / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "left")
      .text(percentageString);

  // Make the breadcrumb trail visible, if it's hidden.
  d3.select("#trail")
      .style("visibility", "");

}