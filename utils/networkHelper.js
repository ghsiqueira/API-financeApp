// utils/networkHelper.js
const os = require('os')

// Importar chalk de forma compatível
let chalk
try {
  chalk = require('chalk')
} catch (error) {
  // Fallback se chalk não estiver disponível
  chalk = {
    blue: (text) => `[BLUE] ${text}`,
    green: (text) => `[GREEN] ${text}`,
    red: (text) => `[RED] ${text}`,
    yellow: (text) => `[YELLOW] ${text}`,
    gray: (text) => `[GRAY] ${text}`,
    cyan: (text) => `[CYAN] ${text}`,
    white: (text) => `[WHITE] ${text}`
  }
}

class NetworkHelper {
  static getLocalIPs() {
    const interfaces = os.networkInterfaces()
    const ips = []

    Object.keys(interfaces).forEach(interfaceName => {
      interfaces[interfaceName].forEach(networkInterface => {
        // Pular loopback e interfaces não ativas
        if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
          ips.push({
            name: interfaceName,
            ip: networkInterface.address,
            type: this.getNetworkType(networkInterface.address)
          })
        }
      })
    })

    return ips
  }

  static getNetworkType(ip) {
    if (ip.startsWith('192.168.')) return 'WiFi/Ethernet Local'
    if (ip.startsWith('10.')) return 'Rede Corporativa'
    if (ip.startsWith('172.')) return 'Rede Privada'
    return 'Outro'
  }

  static getPrimaryIP() {
    const ips = this.getLocalIPs()
    
    // Priorizar IPs de WiFi/Ethernet local
    const wifiIP = ips.find(ip => ip.type === 'WiFi/Ethernet Local')
    if (wifiIP) return wifiIP.ip

    // Fallback para qualquer IP disponível
    return ips.length > 0 ? ips[0].ip : 'localhost'
  }

  static displayNetworkInfo(port) {
    console.log('\n' + chalk.blue('🌐 INFORMAÇÕES DE REDE'))
    console.log(chalk.gray('=' .repeat(50)))
    
    const ips = this.getLocalIPs()
    const primaryIP = this.getPrimaryIP()

    if (ips.length === 0) {
      console.log(chalk.yellow('⚠️  Nenhum IP de rede encontrado'))
      console.log(chalk.gray(`   Usando: http://localhost:${port}`))
      return
    }

    console.log(chalk.green('✅ IPs disponíveis:'))
    ips.forEach(({ name, ip, type }) => {
      const isPrimary = ip === primaryIP
      const marker = isPrimary ? chalk.green('→') : ' '
      console.log(`${marker} ${chalk.cyan(ip)} (${name}) - ${chalk.gray(type)}`)
    })

    console.log('\n' + chalk.blue('📱 URLs para o app mobile:'))
    console.log(chalk.white(`   Recomendado: http://${primaryIP}:${port}/api`))
    
    if (ips.length > 1) {
      console.log(chalk.gray('   Alternativos:'))
      ips.forEach(({ ip }) => {
        if (ip !== primaryIP) {
          console.log(chalk.gray(`   - http://${ip}:${port}/api`))
        }
      })
    }

    console.log('\n' + chalk.blue('🛠️  Configuração:'))
    console.log(chalk.gray(`   O app mobile vai testar estes IPs automaticamente`))
    console.log(chalk.gray(`   Certifique-se que o firewall permite a porta ${port}`))
    
    console.log('\n' + chalk.gray('=' .repeat(50)))
  }

  static createMobileConfig(port) {
    const ips = this.getLocalIPs()
    const primaryIP = this.getPrimaryIP()

    return {
      development: {
        primary: `http://${primaryIP}:${port}/api`,
        fallbacks: ips.map(ip => `http://${ip.ip}:${port}/api`),
        android: `http://10.0.2.2:${port}/api`,
        ios: `http://localhost:${port}/api`
      },
      production: {
        url: 'https://your-api-domain.com/api'
      }
    }
  }

  static watchNetworkChanges(callback) {
    let lastIPs = this.getLocalIPs().map(ip => ip.ip).sort().join(',')

    setInterval(() => {
      const currentIPs = this.getLocalIPs().map(ip => ip.ip).sort().join(',')
      
      if (currentIPs !== lastIPs) {
        console.log(chalk.yellow('\n🔄 Mudança de rede detectada!'))
        this.displayNetworkInfo(process.env.PORT || 5000)
        lastIPs = currentIPs
        
        if (callback) callback(this.getLocalIPs())
      }
    }, 10000) // Verifica a cada 10 segundos
  }
}

module.exports = NetworkHelper