
function compareArray(a, b, n) {
    let b2 = b;
    if(typeof b === 'string') {
        b2 = [];
        for (let i = 0; i < b.length; i++)
            b2.push(b.charCodeAt(i));
    }

    for(let i = 0; i < n; ++i)
        if(a[i] !== b2[i]) return false;

    return true;
}

function adfProcess(bin_js)
{
    const sz = bin_js.byteLength;
    const bin_offset = Module._alloc_bin(sz);
    let bin_wasm = new Uint8Array(Module.HEAPU8.buffer, bin_offset, sz);
    bin_wasm.set(bin_js);

    Module.adf_stack = [];
    const result = Module._process_adf(bin_offset, sz);

    // console.log(result, Module.adf_stack, [bin_offset, sz], bin_js, bin_wasm);

    let adf = null
    if(result && Module.adf_stack.length > 0)
    {
        adf = Module.adf_stack.pop();
        Module.adf_stack = [];
    }
    return adf;
}

class DecaMultiFileLoader {
    constructor(n)
    {
        this.is_loaded = new Array(n);
        this.data = new Array(n);
        this.reader = new Array(n);
        for(let i = 0; i < n; ++i)
        {
            this.is_loaded[i] = false;
            this.data[i] = null;
            this.reader[i] = null;
        }
    };
}


function processTransaction(func, transaction) {
    let all_true = true;
    for(let j = 0; j < transaction.is_loaded.length; ++j)
        all_true = all_true && transaction.is_loaded[j];
    if(all_true)
        func(...transaction.data);

}

// func is a function that takes files.length parameters, func will be called when all files are loaded, with the loaded
// results as the parameters
//
// files can be File or urls [finfo, file_type, file_process]
function multiLoadFiles(func, files) {
    const n = files.length;
    let transaction = new DecaMultiFileLoader(n);

    for(let i = 0; i < n; ++i)
    {
        let file_info = files[i];
        let f_ref =  file_info[0];
        let f_type =  file_info[1];
        let f_process =  file_info[2];

        if(f_process === null)
            f_process = (x) => x;

        if(typeof f_ref === 'string')  // url
        {
            $.get(f_ref, (data, textStatus, jqXHR) => {
                console.log('Loaded: ', f_ref, ' Status: ', textStatus);

                transaction.data[i] = data;
                transaction.reader[i] = null;
                transaction.is_loaded[i] = true;
                processTransaction(func, transaction);
            })
        }
        else
        {
            if(!(f_ref instanceof File))
            {
                f_ref.file(f=>{f_ref=f;},e=>{f_ref=null;})
            }

            let reader = new FileReader();
            transaction.reader[i] = reader;

            reader.onloadend = function() {
                transaction.data[i] = f_process(reader.result);
                transaction.reader[i] = null;
                transaction.is_loaded[i] = true;
                processTransaction(func, transaction);
            }
            reader.onerror = function() {
                transaction.data[i] = data;
                transaction.reader[i] = null;
                transaction.is_loaded[i] = true;
                processTransaction(func, transaction);
            }

            if(f_type === 'array_buffer')
                reader.readAsArrayBuffer(f_ref);
            else if(f_type === 'text')
                reader.readAsText(f_ref)
            else
                throw Error(`unknown f_type == ${f_type}`)
        }
    }
}
