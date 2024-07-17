FROM amazonlinux:2

# Install dependencies
RUN yum -y update \
    && yum -y install \
    python3 \
    python3-pip \
    zip \
    unzip \
    curl \
    tar \
    gzip \
    make \
    npm \
    git \
    && yum clean all

# Install OpenSSL 1.1.1
RUN yum -y install openssl11

# Ensure the system uses the new OpenSSL version
RUN ln -sf /usr/lib64/libssl.so.1.1 /usr/lib64/libssl.so \
    && ln -sf /usr/lib64/libcrypto.so.1.1 /usr/lib64/libcrypto.so

# Install Node.js 14
RUN curl -sL https://rpm.nodesource.com/setup_14.x | bash - \
    && yum -y install nodejs

# Install AWS CLI v2
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf awscliv2.zip

# Install AWS SAM CLI
RUN pip3 install aws-sam-cli

# Install additional Python dependencies
RUN pip3 install aws-lambda-builders Flask rich PyYAML docker boto3 requests typing-extensions ruamel-yaml

# Verify installations
RUN node -v \
    && npm -v \
    && python3 --version \
    && pip3 --version \
    && sam --version \
    && aws --version

# Set PATH
ENV PATH=/root/.local/bin:$PATH

# Default command
CMD ["bash"]
