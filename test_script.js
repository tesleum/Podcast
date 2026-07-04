const text = "سلام حالت چطوره؟\nخوبی؟";
const matches = text.match(/\S+|\s+/g) || [];
console.log(matches);
