
var canvas = document.getElementById('canvas');
var context = canvas.getContext('2d');
var img = new Image();
var width;
var height;
 
 img.onload = function() {
    width = canvas.width = this.width;
    height = canvas.height = this.height;   
    update();
    hueAngle.onchange = update;
}
img.crossOrigin = '';
img.src = 'camera.jpg';

function myImage(canvas, src) {
  // load image in canvas 
	var context = canvas.getContext('2d');
    var img = new Image();
    var that = this;
  
    img.onload = function(){
	canvas.width = img.width;
	canvas.height = img.height;
	context.drawImage(img, 0, 0, img.width, img.height);
	
	// remember the original pixels
    that.original = that.getData();	
	}; 
	img.src = src; 
    this.context = context;
    this.image = img;
	canvas.addEventListener('mousedown', onClick,false);
}

//create prototypes of function 'myImage' 
myImage.prototype.getData = function() {
	return this.context.getImageData(0, 0, this.image.width, this.image.height);
};
myImage.prototype.setData = function(data) {
    return this.context.putImageData(data, 0, 0);
};
myImage.prototype.reset = function() {
    this.setData(this.original);
}
myImage.prototype.convolve = function(matrix, divisor, offset) {
	//divide the number of image pixels by 3 and flatten it
    var mask = [].concat(matrix[0], matrix[1], matrix[2]);
	//the divisor is the number of elements in the matrix 
    if (!divisor) {
        divisor = mask.reduce(function(a, b) {return a + b;}) || 1; 
    }	
    var oldData = this.original;
    var oldPixels = oldData.data;
    var newData = this.context.createImageData(oldData);
    var newPixels = newData.data;
    var len = newPixels.length;
    var results = 0;
    var x = this.image.width;
	
  for (var i = 0; i < len; i++) {
      if ((i + 1) % 4 === 0) {
          newPixels[i] = oldPixels[i];
          continue;
       }
    results = 0;
    var these = [
      oldPixels[i - x * 4 - 4] || oldPixels[i],
      oldPixels[i - x * 4]     || oldPixels[i],
      oldPixels[i - x * 4 + 4] || oldPixels[i],
      oldPixels[i - 4]         || oldPixels[i],
      oldPixels[i],
      oldPixels[i + 4]         || oldPixels[i],
      oldPixels[i + x * 4 - 4] || oldPixels[i],
      oldPixels[i + x * 4]     || oldPixels[i],
      oldPixels[i + x * 4 + 4] || oldPixels[i]
    ];
	
    for (var j = 0; j < 9; j++) {
      results += these[j] * mask[j];
    }
	//the result of previous calculations are divided by the divisor
    results /= divisor;
	// the offset value is added to the division results
    if (offset) {
      results += offset;
    }
    newPixels[i] = results;
  }
  this.setData(newData);
};
// transform rgb 
myImage.prototype.transform = function(formula, factor) {
  var olddata = this.original;
  var oldPixels = olddata.data;
  var newData = this.context.createImageData(olddata);
  var newPixels = newData.data
  var results = [];
  var len = newPixels.length;
  for (var i = 0; i < len; i += 4) {
   results = formula.call(this, oldPixels[i], oldPixels[i+1], oldPixels[i+2], oldPixels[i+3], factor, i);
   newPixels[i]   = results[0]; // red
   newPixels[i+1] = results[1]; // green
   newPixels[i+2] = results[2]; // blue
   newPixels[i+3] = results[3]; // alpha
  }
  this.setData(newData);
};

var transformer = new myImage(
  $('canvas'),
  'camera.jpg'
);
// algorithms for RGB manipulation
var manipulators = [ 
	{ 
	name: 'Greyscale',
	cb: function(r, g, b) {
	var avg = (r + g + b)/3;
	return [avg, avg, avg, 255];}
	},
	{ 
	name: 'Luminosity',
	cb: function(r, g, b) {
	var lum = 0.3  * r + 0.59 * g + 0.11 * b;
	return [lum, lum, lum, 255];}
	},
	{ 
	name: 'Prominent',
	cb: function(r, g, b){
    var prom=(Math.max(r,g,b)+Math.min(r,g,b))/2;
    return [prom, prom, prom, 255];}
    },
	{ 
	name: 'Sepia',
	cb: function(r, g, b) {
		return [(r * 0.393 + g * 0.769 + b * 0.189 ),
		(r * 0.349 + g * 0.686 + b * 0.168 ),
		(r * 0.272 + g * 0.534 + b * 0.131 ),255];}
	}, 
	{ 
	name: 'RGB to BGR',
	cb: function(r, g, b) {
		return [b, g, r, 255];}
	},
	{ 
	name: 'Invert',
	cb: function(r, g, b) {
		return [255 - r, 255 - g, 255 - b, 255];}
	},
	{ 
	name: 'Threshold',
	cb: function(r, g, b) {
		var avg = (r + g +b)/3;
		if (avg > 127.5) {
		r = 255; g = 255; b = 255; 
		}else {
		r = 0; g = 0; b = 0; 
		}
		return [ r, g, b, 255];
	}
}];
// -------- kernel matrices for group pixel processing------------------
var matrices = [
	{ 
	  name: 'Normal',
	  data:
		 [[0, 0, 0],
		  [0, 9, 0],
		  [0, 0, 0]]
	},
	{ 
	  name: 'Sharpen-1',
	  data:
		 [[0, -1, 0],
		  [-1, 5,-1],
		  [0, -1, 0]]
	},
  { 
    name: 'Sharpen-2',
    data:
		 [[-1,-1,-1],
		  [-1, 9,-1],
		  [-1,-1,-1]]
   },
   { 
    name: 'Gaussian blur(appx)',
    data:
		 [[ 1/16, 2/16, 1/16],
		  [ 2/16, 4/16, 2/16],
		  [ 1/16, 2/16, 1/16]]
   },
  {
  name: 'Classic Blur',
    data:
		 [[ 1/9, 1/9, 1/9],
		  [ 1/9, 1/9, 1/9],
		  [ 1/9, 1/9, 1/9]]
  },
  { name: 'Emboss-1',
    data:
		 [[ 2, 0, 0],
		  [ 0,-1, 0],
		  [ 0, 0,-1]],
    offset: 127
  },
  { name: 'Emboss-2',
    data:
		 [[-2,-1, 0],
		  [-1, 1, 1],
		  [ 0, 1, 2]]
	  //offset: 128	  
  },
  { name: 'Edge Detection1',
    data:
		 [[0, 1, 0],
		  [1,-4, 1],
		  [0, 1, 0]]
  },
  { name: 'Edge Detection2',
    data:
		 [[-1, -1,-1],
		  [-1, 8, -1],
		  [-1, -1,-1]]
  },
  {
  name: 'Edge Detection(diagonal)',
    data:
		 [[ 0, 1, 0],
		  [-1, 0, 1],
		  [ 0,-1, 0]]
  },
];

//user interface
function $(id) {return document.getElementById(id);}
 matrices.forEach(function(mask) {
	var s = document.createElement('option');  
    s.innerHTML = mask.name;	
	s.onclick = function() {
    transformer.convolve(mask.data, mask.divisor, mask.offset);
    $('formula').innerHTML = mask.data[0] + '<br>' + mask.data[1] + '<br>' + mask.data[2];
  };
	$('mySelect').appendChild(s);
    $('mySelect').appendChild(document.createElement('br'));	
  });
  
 manipulators.forEach(function(m) {
  var s = document.createElement('option');
   s.innerHTML = m.name;
   s.onclick = function() {
    var factor = null;
    if (s.nextSibling.nodeName.toUpperCase() === 'INPUT') {
      factor = parseInt(s.nextSibling.value, 10);
      if (isNaN(factor)) {
        factor = 0;
      }
    }
    transformer.transform(m.cb, factor);	
    $('formula').innerHTML = m.cb.toString();
  };
  $('mySelect').appendChild(s);
    $('mySelect').appendChild(document.createElement('br'));	
 });

 function update() {
    var angle = parseInt(hueAngle.value, 10);
    var imageData = context.getImageData(0, 0, width, height);
    var newPixels = imageData.data;
    var len = newPixels.length;
     
    for( i = 0;i < len; i += 4) {   
        var lightness = newPixels[i] / 255;
        var colour = hslToRgb(angle, 1, lightness);    
        
        newPixels[i] = colour.r;
        newPixels[i+1] = colour.g;
        newPixels[i+2] = colour.b;
    }
    context.putImageData(imageData, 0, 0);
}

function hslToRgb(hue, saturation, lightness) {   
    var r, g, b;
    var q, p;   
    hue /= 360;   
    if (saturation == 0) {
        r = g = b = lightness;
    } else {
        function hueToRgb(p, q, t) {
            if (t < 0) t++;
            if (t > 1) t--;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }
        if (lightness < 0.5){
			q = lightness * (1 + saturation);
		} else{
			q = lightness + saturation - lightness * saturation;
		}      
        p = 2 * lightness - q;        
        r = hueToRgb(p, q, hue + 1/3);
        g = hueToRgb(p, q, hue);
        b = hueToRgb(p, q, hue - 1/3);
    }    
    return {
        r: r * 255,
        g: g * 255,
        b: b * 255};
}
//----------------------------------
//on mouse click function
function onClick(event) {
	// determines the mouse position
	var rect = canvas.getBoundingClientRect();
	var x = event.clientX - rect.left;
	var y = event.clientY - rect.top;
//alert('Mouse position: ' + x + ',  ' + y);
	rectClick(event);
    if(x > 280 && x < 561 && y > 211 && y < 357){
	document.getElementById('textInfo').innerHTML = 'LCD monitor: 2.7in.<br>320 x digital zoom. The digital zoom allows zooming of captured pictures - magnifying the pixels.';
	}else if(x > 62 && x < 108 && y > 220 && y < 280){
	document.getElementById('textInfo').innerHTML = 'Lens type: ZEISS Vario-Tessar.<br>Focal Length: 2.1 - 57 mm.';
	} else if(x > 334 && x < 380 && y > 40 && y < 57){
	document.getElementById('textInfo').innerHTML = 'Zoom lens button: 27 x optical zoom.<br>The optical zoom is a single lens that changes the distance between the lens and the CCD.';
	} else if(x > 377 && x < 409 && y > 25 && y < 34){
	document.getElementById('textInfo').innerHTML = 'Camera button.';
	} else if(x > 610 && x < 631 && y > 273 && y < 290){
	document.getElementById('textInfo').innerHTML = 'Play button.';
	} else if(x > 609 && x < 629 && y > 336 && y < 356){
	document.getElementById('textInfo').innerHTML = 'Multi-selector: Allows selection of desired item from the menu (◄▲▼►). Pressing the center of the button loads the selected item.';
	} 
	
	else {
		document.getElementById('textInfo').innerHTML = 'There is no information about this part. Try another.'; 
	}	
}
//highlight area on the image event
function rectClick(event) {
	var sizeValue = parseInt(Size.value, 10);
	var e = document.getElementById('highlight');
	var combo = e.options[e.selectedIndex].text;	
	// determines mouse position
	var rect = canvas.getBoundingClientRect();
	var tempX = event.clientX - rect.left;
	var tempY = event.clientY - rect.top;
	if(combo =='Grayscale')
	Grayscale(tempX,tempY, sizeValue); 
}  

function Grayscale(tempX, tempY,sizeValue) {
	var size = sizeValue;	
	context.drawImage(img, 0, 0);		
	var imageData = context.getImageData(0, 0, canvas.width, canvas.height);	
	var pixels = imageData.data;
	for(var x = 0; x < canvas.width; x ++) {
		for(var y =0; y < canvas.height; y ++) {
			var idx = (x + y*canvas.width)*4;			
			if((x < tempX-size) || (x > tempX+size)  || (y<tempY-size) || (y >tempY+size)) {
				var average = (pixels[idx]+ pixels[idx+1]+ pixels[idx+2])/3;	
				pixels[idx] = average; //red
				pixels[idx+1] = average; //green
				pixels[idx+2] = average; //blue	
			}
		}
	}
	context.putImageData(imageData,0,0);
}
//---------------------------------
$('reset').onclick = function(){
  transformer.reset();
  $('formula').innerHTML = '';
};