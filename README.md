# clash-ip-listener

根据节点 IP 生成对应的 listener

# 环境

- [NodeJS](https://nodejs.org/en/download/current)

# 使用教程

1. 将 `.env.sample` 重命名为 `.env` ，并根据需要修改其中内容
2. 在项目根路径下新建文件 `config.yaml`，将需要生成对应 listener 的配置文件内容粘贴进去，然后运行：

```bash
node config.js
```

3. 然后将新生成的文件 `config.temp.yaml` 替换掉当前的配置文件，以 Linux 为例：

```bash
# 将新生成的配置文件替换掉原有的配置文件
cat config.temp.yaml | sudo tee /etc/mihomo/config.yaml > /dev/null && sudo systemctl reload mihomo
```

4. 执行 `generate.js` 脚本，获得根据配置文件节点 IP 划分的 listener 的目标文件 `config.target.yaml`：
> 解析 IP 失败的节点会统一放在名为 **UNKNOWN** 的代理组中，并为其生成名为 **UNKNOWN** 的 listener

```bash
node generate.js
```

5. 恢复原本的配置文件：

```bash
cat config.yaml | sudo tee /etc/mihomo/config.yaml > /dev/null && sudo systemctl reload mihomo
```
