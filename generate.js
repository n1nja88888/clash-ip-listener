import axios from 'axios'
import { configDotenv } from 'dotenv'
import fs from 'fs'
import { HttpsProxyAgent } from 'https-proxy-agent'
import YAML from 'yaml'
import axiosRetry from 'axios-retry'

const env = configDotenv().parsed
const {EXTERNAL_CONTROLLER_URL, SECRET, PROXY_GROUP_NAME, PREFIX, LOCAL_PROXY_URL, STARTING_PORT} = env
const clashAxios = axios.create({
        baseURL: EXTERNAL_CONTROLLER_URL,
        headers: {Authorization: `Bearer ${SECRET}`}
    }),
    ipAxios = axios.create({
        httpsAgent: new HttpsProxyAgent(LOCAL_PROXY_URL),
        timeout: 10e3
    })

axiosRetry(ipAxios, {
    retries: 5,
    onRetry: async (retryCount, error, requestConfig) => {
        const customOnRetry = requestConfig.onRetry
        if (customOnRetry)
            await customOnRetry(retryCount, error, requestConfig)
    }
})

main()

async function main() {
    const proxies = await listProxies()
    console.log('当前所有代理：', Object.keys(proxies))

    if (!proxies[PROXY_GROUP_NAME]) {
        console.error(`找不到代理组 ${PROXY_GROUP_NAME}`)
        return
    }

    console.log('\n开始按IP分组配置...')
    let ipMap
    try {
        const candidates = proxies[PROXY_GROUP_NAME].all
        ipMap = await groupProxiesByIP(candidates)
    } catch (e) {
        console.error('出错:', e.message)
    }

    const listeners = [],
        proxyGroups = []
    let startingPort = Number(STARTING_PORT)
    ipMap.forEach((proxies, ip) => {
        const proxyGroupName = PREFIX + ip
        listeners.push({
            name: ip,
            proxy: proxyGroupName,
            type: 'http',
            port: startingPort++
        })

        proxyGroups.push({
            name: proxyGroupName,
            type: 'url-test',
            proxies: proxies,
            interval: 300,
            timeout: 3000,
            url: 'https://www.google.com/generate_204',
            lazy: true,
            'max-failed-times': 3,
            hidden: true
        })
    })

    // config.listeners.push(...listeners)
    // config['proxy-groups'].push(...proxyGroups)
    const config = {
        listeners,
        'proxy-groups': proxyGroups
    }
    fs.writeFileSync('./config.target.yaml', YAML.stringify(config))
    console.log('配置已成功更新!')
}

async function groupProxiesByIP(proxies) {
    const ipMap = new Map()
    let failure = 0

    for (let proxy of proxies) {
        console.log(`\n切换到 ${proxy} ...`)
        await selectProxy(PROXY_GROUP_NAME, proxy)
        // 等待一小会儿让连接稳定
        await new Promise(r => setTimeout(r, 1e3))

        let ip
        try {
            ip = await getIpViaClashLocal(PROXY_GROUP_NAME, proxy)
        } catch (e) {
            ip = 'UNKNOWN'
            console.warn(`节点IP解析失败 (${proxy}):`, e.message)
            failure++
        }
        console.log(proxy, '出口 IP ->', ip)
        if (!ipMap.has(ip)) ipMap.set(ip, [])
        ipMap.get(ip).push(proxy)
    }

    // 输出统计信息
    console.log(`\n总共处理了 ${proxies.length} 个代理`)
    console.log(`成功解析了 ${proxies.length - failure} 个`)
    console.log(`解析失败了 ${failure} 个`)
    console.log(`发现 ${ipMap.size} 个不同的IP地址`)

    return ipMap
}

// 列出所有可用代理组与节点
async function listProxies() {
    const res = await clashAxios.get(`/proxies`)
    return res.data.proxies // 返回一个对象，key 为代理组名或 proxy 名
}

/* 
对于一个 selector（代理组）选择某个节点
注意：GroupName 必须是你配置文件里定义的 select 类型代理组名称
 */
async function selectProxy(groupName, nodeName) {
    // body: { "name": "节点名" }
    await clashAxios.put(
        `/proxies/${encodeURIComponent(groupName)}`,
        {name: nodeName},
        {
            headers: {'Content-Type': 'application/json'}
        }
    )
}

// 针对指定代理组的指定节点进行健康检查
async function testProxy(groupName, nodeName) {
    await clashAxios.get(`/providers/proxies/${encodeURIComponent(groupName)}/${encodeURIComponent(nodeName)}/healthcheck`)
}

// 通过本地 Clash HTTP 代理请求外网获取出口 IP
async function getIpViaClashLocal(groupName, nodeName) {
    const agent = new HttpsProxyAgent(LOCAL_PROXY_URL)
    const res = await ipAxios.get('https://api.ipify.org', {
        onRetry: async () => await testProxy(groupName, nodeName)
    })
    return res.data
}