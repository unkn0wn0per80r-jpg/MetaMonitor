import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw,
  Cpu,
  Clock
} from 'lucide-react';

// Real targets to monitor
const TARGETS = [
  { id: 'dd', name: 'DownDetector', url: 'https://downdetector.com', checkUrl: 'downdetector.com' },
  { id: 'iidrn', name: 'IsItDownRightNow', url: 'https://isitdownrightnow.com', checkUrl: 'isitdownrightnow.com' },
  { id: 'dfeojm', name: 'DownForEveryoneOrJustMe', url: 'https://downforeveryoneorjustme.com', checkUrl: 'downforeveryoneorjustme.com' },
  { id: 'aws', name: 'AWS Health', url: 'https://health.aws.amazon.com/health/status', checkUrl: 'health.aws.amazon.com' },
  { id: 'azure', name: 'Azure Status', url: 'https://status.azure.com', checkUrl: 'status.azure.com' },
  { id: 'cloudflare', name: 'Cloudflare Status', url: 'https://www.cloudflarestatus.com', checkUrl: 'www.cloudflarestatus.com' },
];

export default function App() {
  const [statuses, setStatuses] = useState({});
  const [globalHealth, setGlobalHealth] = useState(100);
  const [logs, setLogs] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [historicalData, setHistoricalData] = useState({});
  const logEndRef = useRef(null);

  // Blinking cursor
  useEffect(() => {
    const interval = setInterval(() => setCursorVisible(v => !v), 530);
    return () => clearInterval(interval);
  }, []);

  const addLog = (msg, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev.slice(-25), { time: timestamp, msg, type }]);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Real backend check function
  const checkSiteStatus = async (target) => {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(target.url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        cache: 'no-store'
      });
      
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;
      
      if (latency < 15000) {
        return {
          status: latency > 5000 ? 'DEGRADED' : 'UP',
          latency: Math.min(latency, 9999),
          lastChecked: new Date(),
          error: null
        };
      } else {
        return {
          status: 'DEGRADED',
          latency: latency,
          lastChecked: new Date(),
          error: 'High latency detected'
        };
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      
      if (error.name === 'AbortError' || latency > 8000) {
        return {
          status: 'DOWN',
          latency: 0,
          lastChecked: new Date(),
          error: 'Connection timeout'
        };
      }
      
      return {
        status: latency < 3000 ? 'UP' : 'DEGRADED',
        latency: latency,
        lastChecked: new Date(),
        error: null
      };
    }
  };

  const performCheck = async () => {
    if (isScanning) return;
    
    setIsScanning(true);
    addLog("═══ INITIATING GLOBAL SCAN ═══", 'warning');
    
    const newStatuses = {};
    const checkPromises = TARGETS.map(async (target) => {
      addLog(`→ Probing ${target.name}...`, 'info');
      
      const result = await checkSiteStatus(target);
      
      if (result.status === 'DOWN') {
        addLog(`✗ CRITICAL: ${target.name} - ${result.error || 'Unreachable'}`, 'error');
      } else if (result.status === 'DEGRADED') {
        addLog(`⚠ WARNING: ${target.name} - High latency (${result.latency}ms)`, 'warning');
      } else {
        addLog(`✓ ${target.name} operational (${result.latency}ms)`, 'success');
      }
      
      newStatuses[target.id] = result;
      
      setHistoricalData(prev => ({
        ...prev,
        [target.id]: [...(prev[target.id] || []).slice(-20), {
          timestamp: Date.now(),
          status: result.status,
          latency: result.latency
        }]
      }));
      
      return result;
    });

    await Promise.all(checkPromises);
    
    const totalScore = Object.values(newStatuses).reduce((acc, s) => {
      if (s.status === 'UP') return acc + 1;
      if (s.status === 'DEGRADED') return acc + 0.5;
      return acc;
    }, 0);
    
    const health = Math.round((totalScore / TARGETS.length) * 100);
    
    setStatuses(newStatuses);
    setGlobalHealth(health);
    setLastCheck(new Date());
    setIsScanning(false);
    
    addLog(`═══ SCAN COMPLETE - Health: ${health}% ═══`, health < 80 ? 'error' : 'success');
  };

  useEffect(() => {
    performCheck();
    const interval = setInterval(performCheck, 60000);
    return () => clearInterval(interval);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-black text-gray-200 font-mono selection:bg-white selection:text-black antialiased">
      
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(to right, #333 1px, transparent 1px),
                           linear-gradient(to bottom, #333 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      <nav className="fixed top-0 w-full z-50 border-b border-gray-800 bg-black/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 ${isScanning ? 'bg-white animate-pulse' : globalHealth > 90 ? 'bg-green-500' : globalHealth > 70 ? 'bg-amber-500' : 'bg-red-500'}`}></div>
              <span className="text-xl font-bold tracking-tighter text-white">META_MONITOR</span>
            </div>
            <div className="hidden md:flex space-x-8 text-xs font-bold">
              {['status', 'targets', 'logs', 'api'].map((item) => (
                <button
                  key={item}
                  onClick={() => scrollTo(item)}
                  className="hover:text-white uppercase tracking-[0.2em] transition-colors"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <section id="status" className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-[70vh] flex flex-col justify-center border-l border-r border-gray-900">
        <div className="max-w-5xl">
          <div className="inline-flex items-center gap-3 border border-gray-700 px-4 py-2 mb-8 text-xs tracking-[0.2em] uppercase text-gray-400">
             <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-white animate-pulse' : 'bg-gray-500'}`}></span>
             {isScanning ? 'SCAN IN PROGRESS' : lastCheck ? `LAST CHECK: ${lastCheck.toLocaleTimeString()}` : 'INITIALIZING'}
          </div>
          
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold leading-none tracking-tighter mb-8 text-white">
            GLOBAL<br />
            HEALTH: {globalHealth}%
            <span className={`${cursorVisible ? 'opacity-100' : 'opacity-0'} text-white`}>_</span>
          </h1>
          
          <p className="text-xl text-gray-400 max-w-2xl leading-relaxed mb-12 border-l-2 border-white pl-6">
            Real-time monitoring of internet monitoring services. When DownDetector goes down, 
            we're the ones watching. Live infrastructure health checks updated every 60 seconds.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={performCheck}
              disabled={isScanning}
              className="bg-white text-black px-8 py-4 text-sm font-bold uppercase tracking-widest hover:bg-gray-300 transition-colors flex items-center justify-center gap-3 group disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              {isScanning ? 'Scanning...' : 'Execute Scan'}
            </button>
            <button 
              onClick={() => scrollTo('logs')}
              className="border border-gray-700 text-gray-300 px-8 py-4 text-sm font-bold uppercase tracking-widest hover:border-white hover:text-white transition-all flex items-center gap-2"
            >
              <Terminal className="w-4 h-4" />
              View Terminal
            </button>
          </div>
        </div>
      </section>

      <div className="border-t border-b border-gray-800 bg-black py-3 overflow-hidden whitespace-nowrap">
        <div className="animate-marquee inline-block">
          {[...Array(3)].map((_, i) => (
             <React.Fragment key={i}>
                {TARGETS.map(t => {
                   const status = statuses[t.id]?.status || 'PENDING';
                   return (
                     <span key={`${t.id}-${i}`} className="mx-8 text-xs uppercase tracking-[0.3em] font-bold">
                       <span className="text-white">{t.name}:</span>
                       <span className={`ml-2 ${status === 'DOWN' ? 'text-red-500' : status === 'DEGRADED' ? 'text-amber-500' : 'text-green-500'}`}>
                         {status} ///
                       </span>
                     </span>
                   )
                })}
             </React.Fragment>
          ))}
        </div>
      </div>

      <section id="targets" className="py-24 bg-neutral-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 border-b border-gray-800 pb-8">
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Live Status Grid</span>
              <h2 className="text-4xl font-bold text-white">MONITORED TARGETS</h2>
            </div>
            <p className="text-right text-gray-500 mt-4 md:mt-0 max-w-xs text-xs uppercase tracking-widest">
              Next refresh in {isScanning ? '...' : '60s'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border border-gray-800">
            {TARGETS.map((target, index) => {
              const info = statuses[target.id] || { status: 'PENDING', latency: 0 };
              const history = historicalData[target.id] || [];
              const uptime = history.length > 0 
                ? (history.filter(h => h.status === 'UP').length / history.length * 100).toFixed(1)
                : '...';
              
              return (
                <div key={target.id} className={`group relative p-8 border border-gray-800 transition-all ${
                  info.status === 'DOWN' ? 'bg-red-950/20' : 
                  info.status === 'DEGRADED' ? 'bg-amber-950/10' : 
                  'bg-black hover:bg-neutral-900'
                }`}>
                   <div className="absolute top-4 right-4">
                      {info.status === 'UP' ? <CheckCircle className="w-5 h-5 text-green-500" /> : 
                       info.status === 'DOWN' ? <XCircle className="w-5 h-5 text-red-500" /> : 
                       info.status === 'DEGRADED' ? <AlertTriangle className="w-5 h-5 text-amber-500" /> :
                       <Clock className="w-5 h-5 text-gray-500 animate-pulse" />}
                   </div>
                   
                   <div className="mb-8">
                     <span className="text-xs font-bold text-gray-600 uppercase tracking-widest block mb-2">Node_{String(index + 1).padStart(2, '0')}</span>
                     <h3 className="text-xl font-bold text-white mb-1">{target.name}</h3>
                     <a href={target.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-white transition-colors font-mono break-all">
                       {target.checkUrl}
                     </a>
                   </div>

                   <div className="space-y-3 pt-6 border-t border-gray-800">
                     <div className="flex justify-between items-center">
                       <span className="text-[10px] text-gray-600 uppercase tracking-widest">Status</span>
                       <span className={`text-sm font-bold ${
                         info.status === 'DOWN' ? 'text-red-500' : 
                         info.status === 'DEGRADED' ? 'text-amber-500' : 
                         info.status === 'UP' ? 'text-green-500' : 'text-gray-500'
                       }`}>
                         {info.status}
                       </span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-[10px] text-gray-600 uppercase tracking-widest">Response</span>
                       <span className="text-sm font-bold text-white font-mono">
                         {info.latency > 0 ? `${info.latency}ms` : '---'}
                       </span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-[10px] text-gray-600 uppercase tracking-widest">Uptime</span>
                       <span className="text-sm font-bold text-white">{uptime}%</span>
                     </div>
                   </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="logs" className="py-24 border-t border-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
            <div className="lg:col-span-1">
              <h2 className="text-3xl font-bold mb-6 uppercase tracking-tight text-white">System Kernel</h2>
              <div className="space-y-6 text-gray-400 text-sm leading-relaxed">
                <p>
                  Live telemetry from distributed health checks. This terminal shows real-time 
                  connection attempts and response analysis.
                </p>
                <div className="p-6 bg-gray-900/50 border border-gray-800">
                   <div className="flex items-center gap-3 mb-4">
                     <Cpu className="w-5 h-5 text-white" />
                     <span className="text-xs font-bold uppercase tracking-widest text-white">System Status</span>
                   </div>
                   <div className="space-y-2 font-mono text-xs">
                     <div className="flex justify-between">
                       <span>CHECKS</span>
                       <span className="text-white">{Object.keys(statuses).length}/{TARGETS.length}</span>
                     </div>
                     <div className="flex justify-between">
                       <span>UPTIME</span>
                       <span className="text-green-500">{globalHealth}%</span>
                     </div>
                     <div className="flex justify-between">
                       <span>REFRESH</span>
                       <span className="text-white">60s</span>
                     </div>
                   </div>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-2">
              <div className="h-[500px] bg-black border border-gray-800 p-6 font-mono text-xs overflow-hidden flex flex-col relative">
                 <div className="absolute top-0 left-0 right-0 h-6 bg-gray-900/50 border-b border-gray-800 flex items-center px-4 gap-2 z-10">
                    <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                    <div className="w-2 h-2 rounded-full bg-amber-500/50"></div>
                    <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
                    <span className="ml-4 text-[10px] text-gray-500 uppercase tracking-widest">metamonitor@live:~$ tail -f /var/log/health.log</span>
                 </div>
                 <div className="mt-8 flex-1 overflow-y-auto space-y-1 pr-2">
                   {logs.map((log, i) => (
                     <div key={i} className="flex gap-3 pb-1">
                       <span className="text-gray-700 shrink-0 select-none text-[10px]">[{log.time}]</span>
                       <span className={`text-[11px] ${
                         log.type === 'error' ? 'text-red-400 font-bold' : 
                         log.type === 'warning' ? 'text-amber-400' : 
                         log.type === 'success' ? 'text-green-400' : 'text-gray-500'
                       }`}>
                         {log.msg}
                       </span>
                     </div>
                   ))}
                   <div ref={logEndRef} />
                   {isScanning && (
                     <div className="flex gap-3">
                       <span className="text-gray-700 text-[10px]">[{new Date().toLocaleTimeString('en-US', { hour12: false })}]</span>
                       <span className="animate-pulse text-gray-500 text-[11px]">Processing...</span>
                     </div>
                   )}
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="api" className="py-32 bg-neutral-950 border-t border-gray-900">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4 text-white uppercase tracking-tight">API Access</h2>
            <p className="text-gray-500 text-sm">Integrate real-time monitoring into your infrastructure</p>
          </div>
          
          <div className="bg-black border border-gray-800 p-8 font-mono text-xs">
            <div className="mb-6">
              <span className="text-gray-600 uppercase tracking-widest text-[10px]">GET Endpoint</span>
              <div className="mt-2 bg-gray-900 p-4 border border-gray-800">
                <code className="text-green-400">GET https://api.metamonitor.io/v1/status</code>
              </div>
            </div>
            
            <div className="mb-6">
              <span className="text-gray-600 uppercase tracking-widest text-[10px]">Response Format</span>
              <div className="mt-2 bg-gray-900 p-4 border border-gray-800 overflow-x-auto">
                <pre className="text-gray-400">{`{
  "globalHealth": ${globalHealth},
  "timestamp": "${new Date().toISOString()}",
  "targets": {${TARGETS.slice(0, 2).map(t => `
    "${t.id}": {
      "name": "${t.name}",
      "status": "${statuses[t.id]?.status || 'PENDING'}",
      "latency": ${statuses[t.id]?.latency || 0}
    }`).join(',')}
  }
}`}</pre>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-800 flex justify-between items-center">
              <span className="text-gray-600 text-[10px] uppercase tracking-widest">Coming Soon: REST API + WebSocket</span>
              <button className="bg-white text-black px-6 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-gray-300 transition-colors">
                Join Waitlist
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-gray-900 bg-black text-center text-xs text-gray-600 uppercase tracking-widest">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-left">
               <p className="text-white font-bold mb-1">META_MONITOR SYSTEM</p>
               <p>&copy; 2025. Monitoring the monitors.</p>
            </div>
            <div className="flex gap-6">
               <span className="px-3 py-1 border border-gray-800 text-[10px]">V.2.0.0</span>
               <span className="px-3 py-1 border border-gray-800 text-[10px]">LIVE</span>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
      `}</style>
    </div>
  );
}
