console.log("- Запуск.");

const puppeteer = require("puppeteer");
const reader = require("xlsx");
const prompt = require("prompt-sync")();

console.log("- Вставьте ссылку на страницу Auction.ru, где отображается результат поиска лотов и нажмите 'Enter'.\n  (Вы можете вставить скопированный текст нажатием правой кнопки мыши).");
var urlInput = prompt("  Ваша ссылка:>");

(async () =>{
    //make sure the url contains the pg and ipp=180 parts
    let pageUrl = urlInput; 
    pageUrl = validate_url(pageUrl);

    //get number of pages
    console.log("- Поиск страниц...");
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    await page.goto(pageUrl, {timeout: 0}); 
    const numberOfPages = await page.evaluate(() =>{
        let queryResult = document.querySelector(".listing__pager__link span");//if this returns null, it means there's only one page
        if(queryResult == null){
            return 1;
        }
        else{
            return queryResult.innerHTML;
        }
    })
    await browser.close();

    console.log("- Найдено "+numberOfPages+" страниц(ы) по 180 лотов.");

    //if there are multiple pages, then make sure we start parsing them from the first one
    if(pageUrl.search("pg=0")==-1 && numberOfPages>1){
        for(let i = 1; i < numberOfPages; i++){
            pageUrl = pageUrl.replace("pg="+i,"pg=0");
        }  
    }      

    //collect data from each page
    let lots = [];
    for(let i = 0; i < numberOfPages; i++){
        var currPage = i+1;
        console.log("- Сбор данных со страницы "+currPage+"...");
        lots = await add_page_data_to_array(lots, pageUrl.replace("pg=0","pg="+i));
        console.log("- Сбор данных со страницы "+currPage+" завершен.");
    }

    //export to excel
    console.log("- Экспорт в xlsx...");
    let workBook = reader.utils.book_new();
    const workSheet = reader.utils.json_to_sheet(lots);
    reader.utils.book_append_sheet(workBook, workSheet, "Лоты Auction.ru");
    reader.writeFile(workBook, "auction_ru_lots.xlsx");
    console.log("- Экспорт в xlsx завершен.");

    prompt("- Нажмите 'Enter' чтобы выйти из программы:>");
})()

async function add_page_data_to_array(array, url){
    //go to the page
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();   
    await page.goto(url, {timeout: 0});

    //get all lot name values from the page
    let names = await page.evaluate(() => {
        return Array.from(document.querySelectorAll(".offer_snippet_body_top--title"), el => el.innerHTML);
    })

    //get all lot price values from the page
    let prices = await page.evaluate(() => {
        return Array.from(document.querySelectorAll(".offer_snippet_body_price--value val"), el => el.innerHTML);
    })

    //add collected values to single array
    for (let i = 0; i < names.length; i++) {
        await array.push({"Название лота": names[i], "Цена лота": prices[i]});
    }

    //close browser
    await browser.close();

    return array;
}

function validate_url(url){

    let pgIsSpecified;
    let ippIsSpecified;

    if(url.search("pg=")==-1){
        console.log("- pg неуказано в url.");
        pgIsSpecified = false;
    }
    else{
        console.log("- pg указано в url.");
        pgIsSpecified = true;
    }

    if(url.search("ipp=")==-1){
        console.log("- ipp неуказано в url.");
        ippIsSpecified = false;
    }
    else{
        console.log("- ipp указано в url.");
        ippIsSpecified = true;
    }

    if(!pgIsSpecified){
        if(ippIsSpecified){
            url.replace("ipp=","pg=0&ipp=")
        }
        else{
            if(url.search("flt")==-1){
                url = url+"?pg=0";
            }
            else{
                url = url+"&pg=0";
            }
        }
    }

    if(!ippIsSpecified){
        url = url+"&ipp=180";
    }

    return url;
}

