# Nginx Configuration Troubleshooting Guide

## Root Cause Analysis: Cricket Scorer Nginx Issues

### Problem Description
During deployment, the Cricket Scorer application would run perfectly on port 3000 (`curl localhost:3000` showed full Cricket Scorer HTML), but nginx would serve test pages or show nothing at all when accessed via the domain.

### Root Cause Identified
**Complex nginx site configurations cause conflicts on AlmaLinux 9 production servers.**

The issue was caused by trying to use Ubuntu/Debian-style nginx configurations with:
- `/etc/nginx/sites-available/` and `/etc/nginx/sites-enabled/` directories
- Complex server block configurations with multiple includes
- Separate configuration files that could conflict with default settings

### Why This Failed
1. **AlmaLinux/RHEL nginx setup differs from Ubuntu/Debian**
2. **Default configurations in `/etc/nginx/conf.d/` were interfering**
3. **Complex include structures created conflicts**
4. **sites-enabled approach not reliably supported on all systems**

### Working Solution
**Use minimal, direct nginx.conf configuration:**

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    server {
        listen 80 default_server;
        server_name _;
        
        location / {
            proxy_pass http://localhost:3000;
            proxy_set_header Host $host;
        }
    }
}
```

### Key Principles for Reliable Nginx Setup
1. **Keep it simple** - Direct configuration in main nginx.conf
2. **Remove all conflicting configs** - Clear sites-available, sites-enabled, conf.d
3. **Use minimal proxy headers** - Only essential headers
4. **Single server block** - Avoid multiple server definitions
5. **Default server catch-all** - Use `server_name _;` to catch all requests

### Implementation in deploy-cricket-scorer.sh
The deployment script now:
1. Stops nginx completely
2. Removes ALL existing configurations
3. Creates minimal nginx.conf directly
4. Tests configuration before starting
5. Uses emergency recovery approach

### Emergency Recovery Command
If nginx fails, run:
```bash
sudo ./emergency-services-fix.sh
```

This creates the absolute minimal working nginx configuration.

### Prevention
- Always use the minimal nginx.conf approach for production deployments
- Avoid complex site configurations unless absolutely necessary
- Test nginx configuration after any changes
- Keep emergency recovery script available

### Files Updated
- `deploy-cricket-scorer.sh` - Contains emergency nginx recovery
- `emergency-services-fix.sh` - Standalone emergency fix script

This approach ensures reliable nginx proxy functionality across different Linux distributions and server configurations.