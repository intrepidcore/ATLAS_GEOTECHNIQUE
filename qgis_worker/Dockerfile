FROM qgis/qgis:release-3_34

RUN apt-get update && apt-get install -y python3-pip && rm -rf /var/lib/apt/lists/*

COPY ./requirements.txt /app/requirements.txt
RUN pip3 install --no-cache-dir -r /app/requirements.txt

ENV QT_QPA_PLATFORM=offscreen
ENV XDG_RUNTIME_DIR=/tmp/runtime-qgis
ENV PYTHONPATH=/usr/share/qgis/python

WORKDIR /app
COPY ./src /app/src
COPY ./project /app/project

CMD ["python3", "/app/src/worker.py"]
