$( document ).ready(function() {
    $(".scritch").on("click", function(){
        // only want one number-picker at a time
        $(".number-picker").remove();
        $(this).append( getNumberPicker($(this)) );
    });

    $(".scritch").on("contextmenu", function(){
        $(this).empty();
        calculate();
        return false;
    });

    $("body").on("keyup", numKey );

    $(".reset").on("click", cleanSlate );

    $(".tab-content").on("click",changeTab);

});



function getNumberPicker( root ){
    const picker = $("<div class='number-picker'>");
    const live = getLiveNumbers();

    // can't pick more than 4 numbers
    if( live.length >= 4 ) return;

    for( let i=0; i<9; ++i ){
        if( live.includes(i+1) )
            picker.append( getDeadOption(i+1) );
        else
            picker.append( getNumberOption(root,i+1) );
    }
    return picker;
}

function getNumberOption(root,num){
    const oneOption = $("<div class='number-option'>");
    oneOption.on("click",function(){
        applyNumberOption( root,num );
        return false;
    });
    oneOption.append( num );
    return oneOption;
}

function getDeadOption(num){
    const oneOption = $("<div class='number-dead'>");
    oneOption.append( num );
    return oneOption;
}


function numKey(event){
    const which = event.which;
    if( which == 82 ) return cleanSlate();
    if( which < 49 ) return;
    if( which > 57 ) return;
    const num = which - 48;
    const live = getLiveNumbers();
    if( live.includes(num) ) return flashNum(num);
    const picker = $(".number-picker");
    if(picker.length ==0) return;
    applyNumberOption( picker.parent(), num );
    return false;
}

function applyNumberOption(root,num){
    root.empty().append( num );
    calculate();
}


function flashNum(num){
    let target = null;
    $(".scritch").each(function(){
        const maybeTarget = $(this);
        const thisInt = parseInt( $(this).text(), 10);
        if( num === thisInt ){target = maybeTarget; return false; }
    });
    if( !target ) return false;
    target.animate({ "opacity": 0, }, 100, "swing", endFlash);
    return false;
}

function endFlash(){
    $(this).animate({ "opacity": 1, }, 100, "swing");
}


function highlightCells(targets){
    $(".scritch").each(function(index){
        if( ! targets.includes(index) )
            $(this).removeClass( "pickme" );
        else
            $(this).addClass( "pickme" );
    });
}

/** Called when completely resetting.  */
function cleanSlate(){
    $(".scritch").removeClass( "pickme" )
            .text("");
    $(".line").text("");
    return false;
}

function displayLinePredictions( data, bests ){
    // return { index: index, max: max, min: min, avg: avg, };
    data.forEach(x=>{
        const lineElement = $(".line" +x.index );
        let valElement;

        valElement = $("<div>").text(
            "Max: "  +x.max  +" "  +getOdds(x.max, x.raw) );
        if( x.max == bests.max ) valElement.addClass("best");
        lineElement.append( valElement );

        valElement = $("<div>").text( "Avg: "  +x.avg );
        if( x.avg == bests.avg ) valElement.addClass("best");
        lineElement.append( valElement );

        valElement = $("<div>").text( "Min: "  +x.min );
        if( x.min == bests.min ) valElement.addClass("best");
        lineElement.append( valElement );

        valElement = $("<div>").text( "All: " +rawDisplay(x.raw) );
        valElement.addClass("all");
        lineElement.append( valElement );
    });
}

function getOdds( oneVal, raw ){
    const hitCount = raw.filter( x=> x==oneVal ).length;
    const ratio = Math.round( raw.length/hitCount );
    return "(1:"  +ratio  +")";
}

function rawDisplay(raw){
    raw.sort();
    const rawMap = {};
    raw.forEach(x =>{
        const key = x+"";
        const count = rawMap[key] || 0;
        rawMap[key] = count +1;
    });
    const out = [];
    for(const [key, value] of Object.entries(rawMap)){
        const count = value;
        if( count <= 1 ) out.push( key );
        else out.push( `${key} (${value})` );
    }
    return out.join(", ");
}



function calculate(){
    const live = getLiveNumbers();
    const free = getFreeNumbers(live);

    if( live.length == 0 ) return cleanSlate();
    if( free.length == 0 ) return;


    // can only place four numbers, then we calc to pick a row
    if( live.length >= 4 ) return doFinalCalc();

    // get all futures with the jackpot
    const lines = getAllLines();
    const grid = getValuesGrid();

    const winners = [];
    const weightedGrid = new Array(9).fill(0);
    let desired;

    
    desired = [1,2,3];
    for( let i=0; i<lines.length; ++i ){
        const oneLine = lines[i];
        const vals = getLineValues(grid,oneLine);
        if( !isWinnerRow(desired,vals,free) ) continue;
        // good line! Track the index
        winners.push( i );
        oneLine.forEach(x=> weightedGrid[x] += 3 );
    }

    desired = [9,8,7];
    for( let i=0; i<lines.length; ++i ){
        const oneLine = lines[i];
        const vals = getLineValues(grid,oneLine);
        if( !isWinnerRow(desired,vals,free) ) continue;
        // good line! Track the index
        winners.push( i );
        oneLine.forEach(x=>  weightedGrid[x] += 2 );
    }

    
    for( let i=0; i<lines.length; ++i ){
        const oneLine = lines[i];
        const vals = getLineValues(grid,oneLine);
        if( !isBronzeRow(vals,free) ) continue;
        // good line! Track the index
        winners.push( i );
        oneLine.forEach(x=>  weightedGrid[x] += 1 );
    }

    // can't place values where value exists
    for( let i=0; i<9; ++i ){
        if( grid[i] < 1 ) continue;
        weightedGrid[i] = 0;
    }

    console.log( "Winners: ", winners );
    console.log( "Grid: ",  weightedGrid );

    const maxWeight = Math.max(...weightedGrid);
    const targetCells = [];
    for( let i=0; i<9; ++i ){
        if( weightedGrid[i] == maxWeight )
            targetCells.push(i);
    }
    highlightCells( targetCells );
}



function doFinalCalc(){

    // better tidy up!
    $(".pickme").removeClass("pickme");

    const lines = getAllLines();
    const grid = getValuesGrid();
    const live = getLiveNumbers();
    const free = getFreeNumbers(live);

    const predictions = [];

    for( let i=0; i<lines.length; ++i ){
        const oneLine = lines[i];
        const vals = getLineValues(grid,oneLine)
                .filter( x=> x>0 );
        predictions.push( predictLine( vals, free, i ) );
    }

    let bestMax=0, bestAvg=0, bestMin=0;
    predictions.forEach(x=>{
        bestMax = Math.max( bestMax, x.max );
        bestAvg = Math.max( bestAvg, x.avg );
        bestMin = Math.max( bestMin, x.min );
    });

    const bests = { max: bestMax, avg: bestAvg, min: bestMin, };

    displayLinePredictions(predictions, bests);
}

const winnings = [
    0, 0, 0, 0, 0, 0, 
    10000,
    36, 720, 360, 80, 252, 108, 72, 54,
    180, 72, 180, 119, 36, 306, 1080, 144,
    1800, 3600,
];

function predictLine( vals, free, index ){
    const perms = getPermutations( vals, free );
    const possibleWinnings = perms.map(x=> winnings[x] );

    const max = Math.max( ...possibleWinnings );
    const min = Math.min( ...possibleWinnings );
    const avg = possibleWinnings.reduce((a, b) => a + b) / possibleWinnings.length;

    return { index: index, raw: possibleWinnings,
        max: max, min: min, avg: avg, };
}

/** Returns an array of all permutations of the params.
 * Every permutation is length three or less. */
function getPermutations(given, options){
    // recursion break
    if( given.length >= 3 ) return [ getSum(given) ];

    const perms = [];
    options.forEach((oneOption,index)=>{
        const newGiven = given.concat([oneOption]);
        const newOptions = getWithoutIndex( options, index );
        const somePerms = getPermutations(newGiven, newOptions);
        somePerms.forEach(x=> perms.push(x) );
    });
    return perms;
}


function getSum(values){
    return values.reduce((a, b) => a + b, 0);
}




/** Given current vals and available options,
 * calc if given scenario is a *possible* winner. */
function isWinnerRow(desired,vals,options){
    // row must not have non-winner vals
    if(! isWinnerVals(desired,vals) ) return false;
    // get count of current vals that are winners
    const winOptionCount = options.filter(x=>{
        return desired.includes(x);
    }).length;
    // get count of "empties" in row
    const emptyCount = vals.filter(x=>{
        return x < 1;
    }).length;
    // return true if winners can fit (perfectly) in empty cells
    return winOptionCount == emptyCount;
}


/** Given the current vals of a row, col, or diag,
 * calc if is a possible winner. */
function isWinnerVals(desired,vals){
    if( vals.length == 0 ) return true;
    return vals.every(x=>{
        if( x < 1 ) return true;
        return desired.includes(x);
    });
}



/** Given current vals and available options,
 * calc if given scenario is a *possible* BRONZE winner.
 * A bronze win is when values total 21. */
function isBronzeRow(vals,options){
    // total of values as they stand
    const currTotal = vals.reduce((a, b) => a + b, 0);

    // get count of "empties" in row
    const emptyCount = vals.filter(x=>{
        return x < 1;
    }).length;

    // line full? Easy enough
    if( emptyCount == 0 ){
        console.log( "One total: "+currTotal );
        return currTotal==21;
    }

    // one empty? Do we have the val we need?
    if( emptyCount == 1 ){
        const needed = 21 - currTotal;
        return options.includes( needed );
    }

    // otherwise, lets recurse!
    // iterate on options
    for(let i=0; i<options.length; ++i){
        const subOptions = getWithoutIndex( options, i );
        const newVals = dropOneEmpty(vals);
        newVals.push( options[i] );
        const winner = isBronzeRow(newVals, subOptions);
        if( winner ) return true;
    }
    // still here? no good
    return false;
}

function getWithoutIndex(arr, index){
    return arr.filter( (x,i)=> i != index );
}

function dropOneEmpty(arr){
    let dropped = false;
    const newArr = [];
    for( let i=0; i<arr.length; ++i ){
        const thisVal = arr[i];
        if( thisVal > 0 || dropped ){ newArr.push( thisVal ); continue;}
        dropped = true;
    }
    return newArr;
}




/** Returns the values of the given line from the given grid. */
function getLineValues(grid,oneLine){
    return oneLine.map(x=>grid[x]);
}

/** Returns array "grid" of currently selected live values.
 * Empty cells will be filled with -1. */
function getValuesGrid(){
    const nums = [];
    $(".scritch").each(function(){
        const oneNum = parseInt( $(this).text(), 10);
        if( !oneNum ) nums.push(-1);
        else nums.push( oneNum );
    });
    return nums;
}

/** Returns an array of arrays. Each subarray is a set of indexes
 * of the grid, representing a valid "winline". */
function getAllLines(){
    return [
        // rows
        [0,1,2],
        [3,4,5],
        [6,7,8],
        // cols
        [0,3,6],
        [1,4,7],
        [2,5,8],
        // diags
        [0,4,8],
        [2,4,6],
    ];
}


/** Returns an array of all numbers currently selected.
 * May return an empty array. */
function getLiveNumbers(){
    const nums = [];
    $(".scritch").each(function(){
        const oneNum = parseInt( $(this).text(), 10);
        if( !!oneNum ) nums.push( oneNum );
    });
    return nums;
}

/** Returns an array of all numbers NOT currently selected.
 * May return an empty array. */
function getFreeNumbers(live){
    const free = [];
    for( let i=0; i<9; ++i ){
        const num = i+1;
        if( live.includes(num) ) continue;
        free.push( num );
    }
    return free;
}




function changeTab(event){
    const clickedTab = $(event.target);
    if( clickedTab.hasClass("tab-content") ) return;
    if( clickedTab.hasClass("active") ) return;

    $(".tab-content div").removeClass("active");
    clickedTab.addClass("active");

    $(".tab-area").removeClass("active");
    if( clickedTab.hasClass("tab-legend") ){
        $(".tab-area-legend").addClass("active");
    } else {
        $(".tab-area-shortcuts").addClass("active");
    }

}