FROM ubuntu:20.04

# Set environment variable for non-interactive apt install
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    tzdata \
    python3.9 \
    python3.9-venv \
    python3.9-dev \
    python3-pip \
    zip \
    unzip \
    curl \
    tar \
    gzip \
    make \
    npm \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set timezone to avoid interactive configuration
RUN ln -fs /usr/share/zoneinfo/Etc/UTC /etc/localtime && dpkg-reconfigure --frontend noninteractive tzdata

# Install Node.js 14
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - && \
    apt-get install -y nodejs

# Install AWS CLI v2
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    ./aws/install && \
    rm -rf awscliv2.zip

# Install AWS SAM CLI
RUN pip3 install aws-sam-cli

# Install additional Python dependencies
RUN pip3 install aws-lambda-builders Flask rich PyYAML docker boto3 requests typing-extensions ruamel-yaml

# Verify installations
RUN node -v && \
    npm -v && \
    python3.9 --version && \
    pip3 --version && \
    sam --version && \
    aws --version

# Set PATH
ENV PATH=/root/.local/bin:$PATH

# Default command
CMD ["bash"]
