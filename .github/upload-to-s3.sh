#!/usr/bin/env bash
#
# © 2024 Snyk Limited
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

set -exo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# shellcheck disable=SC2002
BASE="vscode"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_S3_BUCKET_NAME="${AWS_S3_BUCKET_NAME:-snyk-test}"
DRY_RUN=

if [ $# -eq 0 ]; then
  echo "please provide a release channel as parameter (preview/stable)"
  exit 1
fi

RELEASE_CHANNEL=$1

if [ $# -eq 2 ]; then
  DRY_RUN=--dryrun
fi

if [ $# -gt 2 ]; then
  echo "Too many parameters"
  echo "Usage: upload-to-s3.sh <release-channel> <dryrun>"
  exit 1
fi

function uploadFile() {
  FILENAME_SRC=$1
  FILENAME_DST=$2
  DRY_RUN=${3:-}

  # shellcheck disable=SC2086
  aws s3 cp $DEBUG $DRY_RUN "$FILENAME_SRC" "s3://$AWS_S3_BUCKET_NAME/$BASE/$FILENAME_DST"
}

# publish repo
mv $SCRIPT_DIR/../*.vsix snyk-vulnerability-scanner-preview.vsix
FILENAME_SRC="snyk-vulnerability-scanner-preview.vsix"
FILENAME_DST="$RELEASE_CHANNEL"
# shellcheck disable=SC2086
uploadFile $FILENAME_SRC $FILENAME_DST $DRY_RUN
