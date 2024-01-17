function g_dash(_str=''){
    return _str.replace(/ /g, '-').toLowerCase()
}
function g_handle(_str=''){
    return g_dash(_str).split('|')[0]
}
function g_id(_str=''){
    const _ids = g_dash(_str).split('|')
    return _ids[_ids.length-1]
}