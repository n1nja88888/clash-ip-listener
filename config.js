import { configDotenv } from 'dotenv'
import fs from 'fs'
import YAML from 'yaml'

const env = configDotenv().parsed
const { EXTERNAL_CONTROLLER_URL, SECRET, LOCAL_PROXY_URL, PROXY_GROUP_NAME } = env
main()

function main() {
	const config = YAML.parse(fs.readFileSync('./config.yaml', 'utf8'))

	// 开启外部访问和本地代理
	config['external-controller'] = new URL(EXTERNAL_CONTROLLER_URL).host
	config.secret = SECRET
	config['mixed-port'] = Number(new URL(LOCAL_PROXY_URL).port)

	config.ipv6 = true

	config['proxy-groups'] = [
		{
			name: PROXY_GROUP_NAME,
			type: 'select',
			'include-all-proxies': true
		}
	]

	config.rules = [`MATCH,${PROXY_GROUP_NAME}`]

	fs.writeFileSync('./config.temp.yaml', YAML.stringify(config))
}
